const mongoose = require('mongoose');
const IpLog = require('../models/IpLog');
const Admin = require('../models/Admin');
const Agent = require('../models/Agent');
const User = require('../models/User');

async function clearIpLogs() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/betterdr');
        console.log('Connected to MongoDB');

        // Find the user with username NGJ247MA (case insensitive)
        let user = await Admin.findOne({ username: /^NGJ247MA$/i });
        if (!user) user = await Agent.findOne({ username: /^NGJ247MA$/i });
        if (!user) user = await User.findOne({ username: /^NGJ247MA$/i });

        if (!user) {
            console.log('❌ User NGJ247MA not found');
            process.exit(0);
        }

        console.log('✅ Found user:', user.username, 'Role:', user.role, 'ID:', user._id);

        // Find all IP logs for this user
        const logs = await IpLog.find({ userId: user._id });
        console.log(`\nFound ${logs.length} IP log(s) for this user:`);
        logs.forEach(log => {
            console.log(`  IP: ${log.ip} | Status: ${log.status} | Reason: ${log.blockReason || 'N/A'} | Last Active: ${log.lastActive}`);
        });

        // Delete all IP logs for this user to clear the issue
        const result = await IpLog.deleteMany({ userId: user._id });
        console.log(`\n✅ Deleted ${result.deletedCount} IP log(s) for user ${user.username}`);
        console.log('User can now login from any IP address');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

clearIpLogs();
