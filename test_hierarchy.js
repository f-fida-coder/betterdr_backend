const { User, sequelize } = require('./models');

async function testHierarchy() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // Sync database schema
        await sequelize.sync({ alter: true });
        console.log('✅ Database synced');

        // 1. Find or Create Admin
        let admin = await User.findOne({ where: { role: 'admin' } });
        if (!admin) {
            console.log('⚠️ No admin found. Please seed admin first.');
            return;
        }
        console.log(`👤 Admin found: ${admin.username} (ID: ${admin.id})`);

        // 2. Create Agent (simulated logic)
        const agentName = `agent_${Date.now()}`;
        const agent = await User.create({
            username: agentName,
            email: `${agentName}@example.com`,
            password: 'password123',
            role: 'agent',
            status: 'active',
            balance: 0,
            fullName: 'Test Agent'
        });
        console.log(`🕵️ Agent created: ${agent.username} (ID: ${agent.id})`);

        // 3. Create User under Agent
        const userName = `user_${Date.now()}`;
        const user = await User.create({
            username: userName,
            email: `${userName}@example.com`,
            password: 'password123',
            role: 'user',
            status: 'active',
            balance: 0,
            fullName: 'Test User',
            agentId: agent.id // Assigning to agent
        });
        console.log(`👤 User created: ${user.username} (ID: ${user.id}) under Agent ID: ${user.agentId}`);


        // 4. Verify Association (Fetch Agent with SubUsers)
        const fetchedAgent = await User.findByPk(agent.id, {
            include: [{ model: User, as: 'subUsers' }]
        });

        if (fetchedAgent.subUsers.length > 0) {
            console.log('✅ Association Verified: Agent has subUsers.');
            console.log(`   Agent ${fetchedAgent.username} has ${fetchedAgent.subUsers.length} user(s).`);
            console.log(`   - ${fetchedAgent.subUsers[0].username}`);
        } else {
            console.error('❌ Association Failed: Agent has no subUsers.');
        }

        // 5. Verify Reverse Association (Fetch User with Agent)
        const fetchedUser = await User.findByPk(user.id, {
            include: [{ model: User, as: 'agent' }]
        });

        if (fetchedUser.agent && fetchedUser.agent.id === agent.id) {
            console.log('✅ Reverse Association Verified: User belongs to correct Agent.');
        } else {
            console.error('❌ Reverse Association Failed.');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await sequelize.close();
    }
}

testHierarchy();
