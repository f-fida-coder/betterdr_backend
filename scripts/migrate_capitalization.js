const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Admin, Agent, User } = require('../models');

const migrate = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment');
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for migration...');

        // 1. Migrate Admins
        console.log('Migrating Admins...');
        const admins = await Admin.find({});
        for (const admin of admins) {
            admin.username = (admin.username || '').toUpperCase();
            if (admin.firstName) admin.firstName = admin.firstName.toUpperCase();
            if (admin.lastName) admin.lastName = admin.lastName.toUpperCase();
            if (admin.fullName) admin.fullName = admin.fullName.toUpperCase();
            await admin.save();
        }
        console.log(`Migrated ${admins.length} Admins.`);

        // 2. Migrate Agents
        console.log('Migrating Agents...');
        const agents = await Agent.find({});
        for (const agent of agents) {
            agent.username = (agent.username || '').toUpperCase();
            if (agent.fullName) agent.fullName = agent.fullName.toUpperCase();
            await agent.save();
        }
        console.log(`Migrated ${agents.length} Agents.`);

        // 3. Migrate Users
        console.log('Migrating Users...');
        const users = await User.find({});
        for (const user of users) {
            user.username = (user.username || '').toUpperCase();
            if (user.firstName) user.firstName = user.firstName.toUpperCase();
            if (user.lastName) user.lastName = user.lastName.toUpperCase();
            if (user.fullName) {
                user.fullName = user.fullName.toUpperCase();
            } else if (user.firstName || user.lastName) {
                user.fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toUpperCase();
            }
            await user.save();
        }
        console.log(`Migrated ${users.length} Users.`);

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
