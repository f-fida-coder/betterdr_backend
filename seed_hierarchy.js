const { User } = require('./models');
const { connectDB } = require('./config/database');
require('dotenv').config();

const seedDummyData = async () => {
    try {
        await connectDB();

        console.log('🌱 Seeding Dummy Data...');

        // 1. Create Agent
        const agentName = 'agent_smith';
        let agent = await User.findOne({ username: agentName });

        if (!agent) {
            agent = new User({
                username: agentName,
                email: 'smith@matrix.com',
                password: 'password123',
                role: 'agent',
                status: 'active',
                balance: 5000.00
            });
            await agent.save();
            console.log('✅ Created Agent:', agent.username);
        } else {
            console.log('ℹ️  Agent already exists:', agent.username);
        }

        // 2. Create User assigned to Agent
        const userName = 'neo_player';
        let user = await User.findOne({ username: userName });

        if (!user) {
            user = new User({
                username: userName,
                email: 'neo@zion.com',
                password: 'password123',
                role: 'user',
                status: 'active',
                balance: 100.00,
                agentId: agent._id // Relationship
            });
            await user.save();
            console.log('✅ Created User:', user.username, 'assigned to Agent:', agent.username);
        } else {
            console.log('ℹ️  User already exists:', user.username);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedDummyData();
