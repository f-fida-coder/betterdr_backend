const mongoose = require('mongoose');
const { User, Match, Bet, Transaction, BetLimit } = require('../models');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sportsbook_db';

async function runTest() {
    console.log('🧪 Starting Manual Bet Flow Test...');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Setup Test User
        const testUsername = 'test_better_' + Date.now();
        const user = await User.create({
            username: testUsername,
            email: `${testUsername}@example.com`,
            password: 'password123',
            balance: 1000.00,
            pendingBalance: 0.00,
            role: 'user',
            status: 'active'
        });
        console.log(`✅ Created Test User: ${user.username} (ID: ${user._id}) with Balance: $1000`);

        // 2. Setup Test Match
        const match = await Match.create({
            sport: 'tennis',
            externalId: 'test_match_' + Date.now(),
            homeTeam: 'Player A',
            awayTeam: 'Player B',
            startTime: new Date(Date.now() + 3600000), // 1 hour later
            status: 'scheduled',
            odds: {
                moneyline: [1.90, 1.90],
                spread: [1.90, 1.90],
                total: [1.90, 1.90]
            }
        });
        console.log(`✅ Created Test Match: ${match.homeTeam} vs ${match.awayTeam} (ID: ${match._id})`);

        // 3. Setup Bet Limits (Ensure defaults exist)
        await BetLimit.findOneAndUpdate(
            { sportType: 'general', marketType: 'general' },
            { minStake: 1, maxStake: 500, maxPayout: 5000 },
            { upsert: true, new: true }
        );
        console.log('✅ Ensured Default Bet Limits');

        // 4. Place a Bet (Simulate Controller Logic manually or via API - here we simulate Logic closest to Controller)
        console.log('🔄 Simulating Bet Placement...');

        const betAmount = 100.00;
        const odds = 1.90;
        const potentialPayout = betAmount * odds;

        try {
            // Deduct
            const u = await User.findById(user._id);
            const initialBalance = parseFloat(u.balance.toString());
            const newBalance = initialBalance - betAmount;

            u.balance = newBalance;
            u.pendingBalance = parseFloat(u.pendingBalance.toString()) + betAmount;
            u.betCount = (u.betCount || 0) + 1;
            u.totalWagered = parseFloat(u.totalWagered.toString()) + betAmount;
            await u.save();

            // Create Bet
            const bet = await Bet.create({
                userId: u._id,
                matchId: match._id,
                selection: 'Player A',
                odds: odds,
                amount: betAmount,
                type: 'moneyline',
                potentialPayout: potentialPayout,
                status: 'pending',
                matchSnapshot: match.toObject(),
                ipAddress: '127.0.0.1',
                userAgent: 'TestScript/1.0'
            });

            // Create Transaction
            await Transaction.create({
                userId: u._id,
                amount: betAmount,
                type: 'bet_placed',
                status: 'completed',
                balanceBefore: initialBalance,
                balanceAfter: newBalance,
                referenceType: 'Bet',
                referenceId: bet._id,
                reason: 'BET_PLACED',
                description: `Bet placed on ${match.homeTeam} vs ${match.awayTeam}`,
                metadata: { matchId: match._id.toString() }
            });

            console.log(`✅ Bet Placed Successfully! New Balance: $${newBalance}`);
        } catch (err) {
            console.error('❌ Bet Placement Failed:', err);
            throw err;
        }

        // 5. Verify Database State
        const finalUser = await User.findById(user._id);
        const bets = await Bet.find({ userId: user._id });
        const txs = await Transaction.find({ userId: user._id });

        console.log('📊 Verification Results:');
        console.log(`   User Balance: ${finalUser.balance} (Expected 900)`);
        console.log(`   Pending Balance: ${finalUser.pendingBalance} (Expected 100)`);
        console.log(`   Bet Count: ${bets.length} (Expected 1)`);
        console.log(`   Transaction Count: ${txs.length} (Expected 1)`);
        console.log(`   Transaction Balance Snapshot: ${txs[0].balanceBefore} -> ${txs[0].balanceAfter}`);

        if (parseFloat(finalUser.balance) === 900 && bets.length === 1 && txs.length === 1) {
            console.log('🎉 TEST PASSED');
        } else {
            console.error('💥 TEST FAILED: Discrepancies found');
        }

        // Cleanup
        // await User.deleteOne({ _id: user._id });
        // await Match.deleteOne({ _id: match._id });
        // await Bet.deleteMany({ userId: user._id });
        // await Transaction.deleteMany({ userId: user._id });

    } catch (error) {
        console.error('❌ Test Script Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
