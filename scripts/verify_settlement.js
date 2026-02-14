const mongoose = require('mongoose');
const { Match, Bet, User } = require('../models');
const { internalSettleMatch } = require('../controllers/betController');
const dotenv = require('dotenv');

dotenv.config();

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Cleanup previous tests
        await User.deleteMany({ username: /^test_settle/ });
        await Match.deleteMany({ externalId: /^test_match/ });

        const testUser = await User.create({
            username: 'test_settle_user',
            email: 'test_settle@example.com',
            password: 'password123',
            balance: 1000,
            pendingBalance: 0,
            role: 'user'
        });

        const runCase = async (name, matchData, betData, expectedStatus, expectedBalance) => {
            console.log(`\n--- Test Case: ${name} ---`);

            const match = await Match.create(matchData);
            const bet = await Bet.create({
                userId: testUser._id,
                matchId: match._id,
                ...betData,
                matchSnapshot: match.toObject()
            });

            // Adjust user for bet
            testUser.balance = parseFloat(testUser.balance.toString()) - parseFloat(bet.amount.toString());
            testUser.pendingBalance = parseFloat(testUser.pendingBalance.toString()) + parseFloat(bet.amount.toString());
            await testUser.save();

            console.log(`Placed ${bet.type} bet on ${bet.selection}. Balance: ${testUser.balance}, Pending: ${testUser.pendingBalance}`);

            // Update match to finished
            match.status = 'finished';
            await match.save();

            // Run settlement
            await internalSettleMatch({ matchId: match._id });

            const updatedBet = await Bet.findById(bet._id);
            const updatedUser = await User.findById(testUser._id);

            console.log(`Result: Bet ${updatedBet.status}. Final Balance: ${updatedUser.balance}`);

            if (updatedBet.status === expectedStatus && Math.abs(Number(updatedUser.balance) - expectedBalance) < 0.01) {
                console.log(`✅ ${name} PASSED`);
            } else {
                console.error(`❌ ${name} FAILED! Expected ${expectedStatus} and $${expectedBalance}`);
            }

            // Restore balance for next test
            testUser.balance = 1000;
            testUser.pendingBalance = 0;
            await testUser.save();
        };

        // Case 1: H2H Win
        await runCase(
            'H2H Home Win',
            {
                externalId: 'test_match_h2h_win',
                homeTeam: 'Lakers', awayTeam: 'Warriors',
                startTime: new Date(), sport: 'basketball', status: 'live',
                score: { score_home: 110, score_away: 100 }
            },
            { selection: 'Lakers', type: 'h2h', odds: 2.0, amount: 100, potentialPayout: 200 },
            'won', 1100
        );

        // Case 2: H2H Loss
        await runCase(
            'H2H Home Loss',
            {
                externalId: 'test_match_h2h_loss',
                homeTeam: 'Lakers', awayTeam: 'Warriors',
                startTime: new Date(), sport: 'basketball', status: 'live',
                score: { score_home: 90, score_away: 100 }
            },
            { selection: 'Lakers', type: 'h2h', odds: 2.0, amount: 100, potentialPayout: 200 },
            'lost', 900
        );

        // Case 3: Spreads Win
        await runCase(
            'Spreads Win (-5.5)',
            {
                externalId: 'test_match_spread_win',
                homeTeam: 'Lakers', awayTeam: 'Warriors',
                startTime: new Date(), sport: 'basketball', status: 'live',
                score: { score_home: 110, score_away: 100 },
                odds: { markets: [{ key: 'spreads', outcomes: [{ name: 'Lakers', price: 1.9, point: -5.5 }, { name: 'Warriors', price: 1.9, point: 5.5 }] }] }
            },
            { selection: 'Lakers', type: 'spreads', odds: 1.9, amount: 100, potentialPayout: 190 },
            'won', 1090
        );

        // Case 4: Spreads Loss
        await runCase(
            'Spreads Loss (-5.5)',
            {
                externalId: 'test_match_spread_loss',
                homeTeam: 'Lakers', awayTeam: 'Warriors',
                startTime: new Date(), sport: 'basketball', status: 'live',
                score: { score_home: 105, score_away: 100 },
                odds: { markets: [{ key: 'spreads', outcomes: [{ name: 'Lakers', price: 1.9, point: -5.5 }, { name: 'Warriors', price: 1.9, point: 5.5 }] }] }
            },
            { selection: 'Lakers', type: 'spreads', odds: 1.9, amount: 100, potentialPayout: 190 },
            'lost', 900
        );

        // Case 5: Totals Over Win
        await runCase(
            'Totals Over Win (210.5)',
            {
                externalId: 'test_match_totals_win',
                homeTeam: 'Lakers', awayTeam: 'Warriors',
                startTime: new Date(), sport: 'basketball', status: 'live',
                score: { score_home: 110, score_away: 105 },
                odds: { markets: [{ key: 'totals', outcomes: [{ name: 'Over', price: 1.9, point: 210.5 }, { name: 'Under', price: 1.9, point: 210.5 }] }] }
            },
            { selection: 'Over', type: 'totals', odds: 1.9, amount: 100, potentialPayout: 190 },
            'won', 1090
        );

    } catch (err) {
        console.error('Test Execution Error:', err);
    } finally {
        await mongoose.disconnect();
    }
};

runTest();
