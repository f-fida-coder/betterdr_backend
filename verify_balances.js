const mongoose = require('mongoose');
const { User } = require('./models');
const { connectDB } = require('./config/database');

const verifyBalances = async () => {
    try {
        await connectDB();
        console.log('--- Verifying Balances ---');

        // 1. Check Admin 'fida'
        const admin = await User.findOne({ username: 'fida' });
        if (admin && admin.unlimitedBalance === true) {
            console.log('✅ Admin "fida" has unlimitedBalance: true');
        } else {
            console.log('❌ Admin "fida" missing unlimitedBalance match');
        }

        // 2. Check a recent user (or create dummy logic conceptually, but checking db is safer)
        const user = await User.findOne({ role: 'user' }).sort({ createdAt: -1 });
        if (user) {
            console.log(`Checking user: ${user.username}`);
            if (user.unlimitedBalance === false || user.unlimitedBalance === undefined) {
                console.log('✅ User has unlimitedBalance: false/undefined');
            } else {
                console.log('❌ User has unlimitedBalance: true (FAIL)');
            }

            const bal = parseFloat(user.balance.toString());
            if (bal === 1000) {
                console.log('✅ User balance is 1000');
            } else {
                console.log(`⚠️ User balance is ${bal} (might be old user or modified)`);
            }
        } else {
            console.log('No users found to check.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification Error:', error);
        process.exit(1);
    }
};

verifyBalances();
