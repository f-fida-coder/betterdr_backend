const { Bet, User, Match } = require('../models');
const mongoose = require('mongoose');

const transactionsEnabled = () => String(process.env.MONGODB_TRANSACTIONS_ENABLED || 'false').toLowerCase() === 'true';
const withSession = (query, session) => (session ? query.session(session) : query);
const saveWithSession = (doc, session) => (session ? doc.save({ session }) : doc.save());
const createWithSession = (Model, docs, session) => (session ? Model.create(docs, { session }) : Model.create(docs));
const runWithOptionalTransaction = async (work) => {
    if (!transactionsEnabled()) {
        return work(null);
    }
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } catch (error) {
        const message = error?.message || '';
        if (message.includes('Transaction numbers are only allowed') || message.toLowerCase().includes('replica set')) {
            return work(null);
        }
        throw error;
    } finally {
        try { session.endSession(); } catch (e) { }
    }
};

// Place a Bet
// Place a Bet
// Place a Bet
// Helper to validate a single selection/leg
const validateSelection = async (matchId, selection, odds, type, session) => {
    const match = await withSession(Match.findById(matchId), session);
    if (!match) throw new Error(`Match not found: ${matchId}`);

    if (!['scheduled', 'live'].includes(match.status)) {
        throw new Error(`Match ${match.homeTeam} vs ${match.awayTeam} is not open for betting`);
    }

    if (match.status === 'scheduled' && match.startTime && new Date(match.startTime).getTime() <= Date.now()) {
        throw new Error(`Betting is closed for ${match.homeTeam} vs ${match.awayTeam}`);
    }

    const markets = Array.isArray(match.odds?.markets) ? match.odds.markets : [];
    const normalizedType = String(type || '').toLowerCase();
    const findMarket = (key) => markets.find(m => String(m.key || '').toLowerCase() === key);

    let market = findMarket(normalizedType);
    if (!market && ['straight', 'moneyline', 'ml', 'h2h'].includes(normalizedType)) {
        market = findMarket('h2h') || findMarket('moneyline') || findMarket('ml');
    }

    // Fallback for manual odds format
    if (!market && match.odds && typeof match.odds === 'object' && !Array.isArray(match.odds.markets)) {
        const outcomes = [];
        if (match.odds.home_win != null) outcomes.push({ name: match.homeTeam, price: Number(match.odds.home_win) });
        if (match.odds.away_win != null) outcomes.push({ name: match.awayTeam, price: Number(match.odds.away_win) });
        if (match.odds.draw != null) outcomes.push({ name: 'Draw', price: Number(match.odds.draw) });
        if (outcomes.length > 0) market = { key: 'h2h', outcomes };
    }

    if (!market || !Array.isArray(market.outcomes) || market.outcomes.length === 0) {
        throw new Error(`Market ${type} not available for ${match.homeTeam} vs ${match.awayTeam}`);
    }

    const outcome = (market.outcomes || []).find(o => o.name === selection || (normalizedType === 'totals' && o.name.toLowerCase().includes(selection.toLowerCase())));
    if (!outcome || outcome.price == null) {
        throw new Error(`Selection ${selection} not available for ${match.homeTeam} vs ${match.awayTeam}`);
    }

    const officialOdds = Number(outcome.price);
    const clientOdds = Number(odds);
    if (Number.isNaN(officialOdds) || (!Number.isNaN(clientOdds) && clientOdds > 0 && Math.abs(officialOdds - clientOdds) > 0.1)) {
        // We allow some flexibility or just log it. For production, strict check is better.
        // throw new Error(`Odds changed for ${match.homeTeam} vs ${match.awayTeam}. Current: ${officialOdds}`);
    }

    return {
        matchId,
        selection: outcome.name,
        odds: officialOdds,
        marketType: market.key,
        point: outcome.point,
        matchSnapshot: match.toObject()
    };
};

// Place a Bet
exports.placeBet = async (req, res) => {
    try {
        const userId = req.user._id;
        const { matchId, selection, odds, amount, type, selections, teaserPoints } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const betType = String(type || 'straight').toLowerCase();
        const betAmount = parseFloat(amount);

        if (isNaN(betAmount) || betAmount <= 0) {
            return res.status(400).json({ message: 'Bet amount must be positive' });
        }

        let createdBets = [];
        await runWithOptionalTransaction(async (session) => {
            const user = await withSession(User.findById(userId), session);
            if (!user) throw new Error('User not found');
            if (['suspended', 'disabled', 'read only'].includes(user.status)) {
                throw new Error('Account is suspended, disabled, or read-only');
            }

            // Validate Min/Max Bet
            if (user.minBet && betAmount < user.minBet) {
                throw new Error(`Minimum bet for your account is ${user.minBet}`);
            }
            if (user.maxBet && betAmount > user.maxBet) {
                throw new Error(`Maximum bet for your account is ${user.maxBet}`);
            }

            const balance = parseFloat(user.balance?.toString() || '0');
            const pending = parseFloat(user.pendingBalance?.toString() || '0');
            const available = Math.max(0, balance - pending);

            let totalRisk = betAmount;
            let validatedSelections = [];

            if (['parlay', 'teaser', 'if_bet', 'reverse'].includes(betType)) {
                if (!Array.isArray(selections) || selections.length < 2) {
                    throw new Error(`${betType.toUpperCase()} requires at least 2 selections`);
                }
                for (const sel of selections) {
                    const validated = await validateSelection(sel.matchId, sel.selection, sel.odds, sel.type || 'straight', session);
                    validatedSelections.push(validated);
                }

                if (betType === 'reverse') {
                    // Reverse is basically 2 If-Bets (A->B and B->A)
                    // Risk is doubled
                    totalRisk = betAmount * 2;
                }
            } else {
                // Straight bet
                const validated = await validateSelection(matchId, selection, odds, type, session);
                validatedSelections.push(validated);
            }

            if (available < totalRisk) {
                throw new Error('Insufficient available balance');
            }

            let potentialPayout = 0;
            if (betType === 'straight') {
                potentialPayout = betAmount * validatedSelections[0].odds;
            } else if (betType === 'parlay') {
                const combinedOdds = validatedSelections.reduce((acc, sel) => acc * sel.odds, 1);
                potentialPayout = betAmount * combinedOdds;
            } else if (betType === 'teaser') {
                // Simplified teaser logic: fixed odds based on legs
                const teaserMultipliers = { 2: 1.8, 3: 2.6, 4: 4.0, 5: 6.5 }; // Example
                const multiplier = teaserMultipliers[selections.length] || selections.length * 1.2;
                potentialPayout = betAmount * multiplier;
            } else if (betType === 'if_bet' || betType === 'reverse') {
                // If bet payout is cumulative but complex. Simplified:
                potentialPayout = betAmount * (validatedSelections[0].odds * validatedSelections[1].odds);
            }

            const balanceBefore = balance;
            const balanceAfter = balance - totalRisk;

            user.balance = balanceAfter;
            user.pendingBalance = pending + totalRisk;
            user.betCount = (user.betCount || 0) + (betType === 'reverse' ? 2 : 1);
            user.totalWagered = parseFloat(user.totalWagered?.toString() || '0') + totalRisk;
            await saveWithSession(user, session);

            const betData = {
                userId,
                amount: betAmount,
                type: betType,
                potentialPayout,
                status: 'pending',
                ipAddress,
                userAgent,
                teaserPoints: teaserPoints || 0
            };

            if (betType === 'reverse') {
                // Create two separate If-Bets for Reverse
                const bet1 = await createWithSession(Bet, [{
                    ...betData,
                    type: 'if_bet',
                    selections: [validatedSelections[0], validatedSelections[1]],
                    potentialPayout: potentialPayout / 2
                }], session);
                const bet2 = await createWithSession(Bet, [{
                    ...betData,
                    type: 'if_bet',
                    selections: [validatedSelections[1], validatedSelections[0]],
                    potentialPayout: potentialPayout / 2
                }], session);
                createdBets.push(bet1[0], bet2[0]);
            } else {
                const bet = await createWithSession(Bet, [{
                    ...betData,
                    selections: validatedSelections,
                    // Backward compatibility fields
                    matchId: validatedSelections.length === 1 ? validatedSelections[0].matchId : null,
                    selection: validatedSelections.length === 1 ? validatedSelections[0].selection : 'MULTI',
                    odds: validatedSelections.length === 1 ? validatedSelections[0].odds : 0,
                    matchSnapshot: validatedSelections.length === 1 ? validatedSelections[0].matchSnapshot : {}
                }], session);
                createdBets.push(bet[0]);
            }

            const Transaction = require('../models/Transaction');
            await createWithSession(Transaction, [{
                userId,
                amount: totalRisk,
                type: 'bet_placed',
                status: 'completed',
                balanceBefore,
                balanceAfter,
                referenceType: 'Bet',
                referenceId: createdBets[0]._id,
                reason: 'BET_PLACED',
                description: `${betType.toUpperCase()} bet placed`,
                ipAddress,
                userAgent
            }], session);
        });

        const updatedUser = await User.findById(req.user._id).lean();
        res.status(201).json({
            message: 'Bet placed successfully',
            bets: createdBets,
            balance: updatedUser.balance,
            pendingBalance: updatedUser.pendingBalance
        });

    } catch (error) {
        console.error('Place Bet Error:', error);
        res.status(400).json({ message: error.message });
    }
};

const internalSettleMatch = async ({ matchId, winner: manualWinner, settledBy = 'system' }) => {
    const match = await Match.findById(matchId);
    if (!match) throw new Error('Match not found');

    // Find all bets that include this match, either as primary or in selections
    const pendingBets = await Bet.find({
        status: 'pending',
        $or: [
            { matchId: matchId },
            { 'selections.matchId': matchId }
        ]
    });

    const results = { total: pendingBets.length, won: 0, lost: 0, voided: 0 };
    if (pendingBets.length === 0) return results;

    const scoreHome = Number(match.score?.score_home ?? 0);
    const scoreAway = Number(match.score?.score_away ?? 0);
    const totalScore = scoreHome + scoreAway;
    const isFinished = match.status === 'finished';

    const getLegResult = (leg, matchData) => {
        const selection = leg.selection;
        const marketType = String(leg.marketType || '').toLowerCase();
        const snapshot = leg.matchSnapshot || {};
        const snapshotMarkets = snapshot.odds?.markets || [];

        if (manualWinner) return selection === manualWinner ? 'won' : 'lost';
        if (!isFinished) return 'pending';

        if (['h2h', 'moneyline', 'ml', 'straight'].includes(marketType)) {
            if (scoreHome > scoreAway) return (selection === matchData.homeTeam) ? 'won' : (selection === 'Draw' ? 'lost' : 'lost');
            if (scoreAway > scoreHome) return (selection === matchData.awayTeam) ? 'won' : 'lost';
            if (scoreHome === scoreAway) return (selection === 'Draw') ? 'won' : 'lost';
        } else if (marketType === 'spreads') {
            const market = snapshotMarkets.find(m => m.key === 'spreads');
            const outcome = market?.outcomes?.find(o => o.name === selection);
            if (outcome && outcome.point != null) {
                const point = Number(outcome.point);
                const adjustedHome = selection === matchData.homeTeam ? scoreHome + point : scoreHome;
                const adjustedAway = selection === matchData.awayTeam ? scoreAway + point : scoreAway;
                if (selection === matchData.homeTeam) {
                    if (adjustedHome > scoreAway) return 'won';
                    if (adjustedHome === scoreAway) return 'void';
                    return 'lost';
                } else {
                    if (adjustedAway > scoreHome) return 'won';
                    if (adjustedAway === scoreHome) return 'void';
                    return 'lost';
                }
            }
        } else if (marketType === 'totals') {
            const market = snapshotMarkets.find(m => m.key === 'totals');
            const outcome = market?.outcomes?.find(o => o.name === selection);
            if (outcome && outcome.point != null) {
                const point = Number(outcome.point);
                const isOver = selection.toLowerCase().includes('over');
                if (isOver) {
                    if (totalScore > point) return 'won';
                    if (totalScore === point) return 'void';
                    return 'lost';
                } else {
                    if (totalScore < point) return 'won';
                    if (totalScore === point) return 'void';
                    return 'lost';
                }
            }
        }
        return 'pending';
    };

    await runWithOptionalTransaction(async (session) => {
        for (const bet of pendingBets) {
            const user = await withSession(User.findById(bet.userId), session);
            if (!user) continue;

            const betType = String(bet.type || 'straight').toLowerCase();
            let betDirty = false;

            // 1. Update individual legs
            for (const leg of bet.selections) {
                if (leg.matchId.toString() === matchId.toString() && leg.status === 'pending') {
                    const res = getLegResult(leg, match);
                    if (res !== 'pending') {
                        leg.status = res;
                        betDirty = true;
                    }
                }
            }

            if (!betDirty) continue;

            // 2. Evaluate overall bet status
            let finalStatus = 'pending';
            if (betType === 'straight') {
                finalStatus = bet.selections[0].status;
            } else if (betType === 'parlay' || betType === 'teaser') {
                const results = bet.selections.map(l => l.status);
                if (results.includes('lost')) finalStatus = 'lost';
                else if (results.every(r => r === 'won' || r === 'void')) {
                    if (results.every(r => r === 'void')) finalStatus = 'void';
                    else if (results.includes('pending')) finalStatus = 'pending';
                    else finalStatus = 'won';
                }
            } else if (betType === 'if_bet') {
                // Settle legs sequentially
                for (let i = 0; i < bet.selections.length; i++) {
                    const leg = bet.selections[i];
                    if (leg.status === 'lost') {
                        finalStatus = 'lost';
                        break;
                    }
                    if (leg.status === 'pending') {
                        finalStatus = 'pending';
                        break;
                    }
                    if (i === bet.selections.length - 1 && leg.status === 'won') {
                        finalStatus = 'won';
                    }
                }
            }

            if (finalStatus === 'pending') {
                await saveWithSession(bet, session);
                continue;
            }

            // 3. Apply results
            const wager = parseFloat(bet.amount.toString());
            const balance = parseFloat(user.balance?.toString() || '0');
            const pending = parseFloat(user.pendingBalance?.toString() || '0');

            // Recalculate payout for Parlays if there are voids
            if (finalStatus === 'won' && (betType === 'parlay' || betType === 'teaser')) {
                const results = bet.selections.map(l => l.status);
                if (results.includes('void')) {
                    if (betType === 'parlay') {
                        const newCombinedOdds = bet.selections.reduce((acc, l) => l.status === 'won' ? acc * l.odds : acc, 1);
                        bet.potentialPayout = wager * newCombinedOdds;
                    } else if (betType === 'teaser') {
                        const wonCount = bet.selections.filter(l => l.status === 'won').length;
                        const teaserMultipliers = { 1: 1.0, 2: 1.8, 3: 2.6, 4: 4.0 };
                        const multiplier = teaserMultipliers[wonCount] || 1.0;
                        bet.potentialPayout = wager * multiplier;
                    }
                }
            }

            bet.status = finalStatus;
            bet.result = finalStatus;
            bet.settledAt = new Date();
            bet.settledBy = settledBy;
            await saveWithSession(bet, session);

            if (finalStatus === 'void') {
                user.balance = balance + wager;
                user.pendingBalance = Math.max(0, pending - wager);
                results.voided++;
            } else if (finalStatus === 'won') {
                const payout = parseFloat(bet.potentialPayout.toString());
                user.balance = balance + payout;
                user.pendingBalance = Math.max(0, pending - wager);
                user.totalWinnings = parseFloat(user.totalWinnings?.toString() || '0') + (payout - wager);

                const Transaction = require('../models/Transaction');
                await createWithSession(Transaction, [{
                    userId: user._id,
                    amount: payout,
                    type: 'bet_won',
                    status: 'completed',
                    balanceBefore: balance,
                    balanceAfter: user.balance,
                    referenceType: 'Bet',
                    referenceId: bet._id,
                    reason: 'BET_WON',
                    description: `${betType.toUpperCase()} bet won`
                }], session);
                results.won++;
            } else {
                user.pendingBalance = Math.max(0, pending - wager);
                results.lost++;
            }
            await saveWithSession(user, session);
        }
    });

    return results;
};

exports.internalSettleMatch = internalSettleMatch;

// Handler for manual/API settlement
exports.settleMatch = async (req, res) => {
    try {
        const { matchId, winner } = req.body;
        const results = await internalSettleMatch({
            matchId,
            winner,
            settledBy: req.user ? 'admin' : 'system'
        });
        res.json({ message: 'Settlement complete', results });
    } catch (error) {
        console.error('Settlement Error:', error);
        res.status(500).json({ message: error.message || 'Error settling bets' });
    }
};

// Get User's Bets
exports.getMyBets = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, limit = 50 } = req.query;

        const query = { userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        const bets = await Bet.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .limit(parseInt(limit))
            .populate('matchId', 'homeTeam awayTeam startTime sport league'); // Join match details

        res.json(bets);

    } catch (error) {
        console.error('Get My Bets Error:', error);
        res.status(500).json({ message: 'Error fetching bets' });
    }
};
