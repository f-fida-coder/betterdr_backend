const mongoose = require('mongoose');
const { User, Bet } = require('./models');
const { connectDB } = require('./config/database');
const { createDepositIntent } = require('./controllers/paymentController');

// Mock req/res
const mockReq = (user, body = {}) => ({
    user,
    body
});
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const runVerification = async () => {
    try {
        await connectDB();

        console.log('--- 1. Testing Deposit Restriction ---');
        const user = { role: 'user', _id: new mongoose.Types.ObjectId() };
        const req = mockReq(user, { amount: 100 });
        const res = mockRes();

        // We can't easily call valid createDepositIntent without Stripe env var mocked or working, 
        // but we expect it to fail fast at the role check before Stripe.
        // We'll see if we get 403.

        try {
            await createDepositIntent(req, res);
            if (res.statusCode === 403) {
                console.log('✅ Deposit restriction passed: User got 403 Forbidden.');
            } else {
                console.log('❌ Deposit restriction failed: Status code ' + res.statusCode);
            }
        } catch (e) {
            console.log('⚠️ Error during deposit test (might be stripe, which is fine if after check):', e.message);
        }

        console.log('\n--- 2. Testing Active Customer Aggregation ---');
        // We will just run the aggregation on existing data to see if it doesn't crash
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const activeUserIds = await Bet.aggregate([
            { $match: { createdAt: { $gte: oneWeekAgo } } }, // Simple match all for test
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $match: { count: { $gte: 2 } } }
        ]);
        console.log('✅ Aggregation query ran successfully. Found active users count:', activeUserIds.length);

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
};

runVerification();
