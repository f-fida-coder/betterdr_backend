const { User } = require('./models');
const { connectDB, mongoose } = require('./config/database');
require('dotenv').config();

const seedRoles = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to database');

        // 1. Ensure Admin
        let admin = await User.findOne({ email: 'admin@example.com' });
        if (!admin) {
            admin = new User({
                username: 'admin',
                email: 'admin@example.com',
                password: 'password123',
                role: 'admin',
                status: 'active',
                fullName: 'Super Admin'
            });
            await admin.save();
            console.log('✅ Created Admin: admin@example.com / password123');
        } else {
            console.log('ℹ️ Admin already exists: admin@example.com');
        }

        // 2. Ensure Agent
        let agent = await User.findOne({ email: 'agent@example.com' });
        if (!agent) {
            agent = new User({
                username: 'agent',
                email: 'agent@example.com',
                password: 'password123',
                role: 'agent',
                status: 'active',
                fullName: 'Test Agent'
            });
            await agent.save();
            console.log('✅ Created Agent: agent@example.com / password123');
        } else {
            console.log('ℹ️ Agent already exists: agent@example.com');
        }

        // 3. Ensure User (Assigned to Agent)
        let user = await User.findOne({ email: 'user@example.com' });
        if (!user) {
            user = new User({
                username: 'user',
                email: 'user@example.com',
                password: 'password123',
                role: 'user',
                status: 'active',
                fullName: 'Test User',
                agentId: agent._id
            });
            await user.save();
            console.log('✅ Created User: user@example.com / password123 (Assigned to Agent)');
        } else {
            // Ensure assignment
            if (user.agentId.toString() !== agent._id.toString()) {
                user.agentId = agent._id;
                await user.save();
                console.log('✅ Updated User: Assigned to Agent');
            }
            console.log('ℹ️ User already exists: user@example.com');
        }

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

seedRoles();
