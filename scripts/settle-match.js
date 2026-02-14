const mongoose = require('mongoose');
const { Match, Bet, User, Transaction } = require('../models');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sportsbook_db';

const settleMatch = async () => {
    const matchId = process.argv[2]; // Get match ID from command arguments
    const winner = process.argv[3]; // Get winner (selection name)

    if (!matchId || !winner) {
        console.error('Usage: node scripts/settle-match.js <matchId> <winner_selection>');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log(`🔄 Settling Match ${matchId} with winner "${winner}"...`);

        const match = await Match.findById(matchId);
        if (!match) {
            console.error('❌ Match not found');
            process.exit(1);
        }

        // Find pending bets
        const pendingBets = await Bet.find({ matchId, status: 'pending' });
        console.log(`Found ${pendingBets.length} pending bets.`);

        let won = 0;
        let lost = 0;

        for (const bet of pendingBets) {
            const user = await User.findById(bet.userId);

            // Normalize for comparison
            const betSelection = bet.selection.toLowerCase().trim();
            const winSelection = winner.toLowerCase().trim();

            console.log(`   Processing Bet ${bet._id}: Selection "${betSelection}" vs Winner "${winSelection}"`);

            if (betSelection === winSelection) {
                // WON
                const payout = parseFloat(bet.potentialPayout.toString());
                const wager = parseFloat(bet.amount.toString());

                bet.status = 'won';
                bet.result = 'won';
                bet.settledAt = new Date();
                bet.settledBy = 'script';
                await bet.save();

                user.balance = parseFloat(user.balance.toString()) + payout;
                user.pendingBalance = parseFloat(user.pendingBalance.toString()) - wager;
                user.totalWinnings = parseFloat(user.totalWinnings.toString()) + (payout - wager);
                await user.save();

                // Log Transaction
                await Transaction.create({
                    userId: user._id,
                    amount: payout,
                    type: 'bet_won',
                    status: 'completed',
                    balanceBefore: user.balance - payout,
                    balanceAfter: user.balance,
                    referenceType: 'Bet',
                    referenceId: bet._id,
                    reason: 'BET_WON',
                    description: `Bet won on ${match.homeTeam} vs ${match.awayTeam}`,
                    metadata: { matchId: match._id.toString() }
                });

                console.log(`      ✅ WON: Payout $${payout}`);
                won++;
            } else {
                // LOST
                const wager = parseFloat(bet.amount.toString());
                bet.status = 'lost';
                bet.result = 'lost';
                bet.settledAt = new Date();
                bet.settledBy = 'script';
                await bet.save();

                user.pendingBalance = parseFloat(user.pendingBalance.toString()) - wager;
                await user.save();

                console.log(`      ❌ LOST`);
                lost++;
            }
        }

        console.log(`\n🎉 Settlement Complete! Won: ${won}, Lost: ${lost}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

settleMatch();
