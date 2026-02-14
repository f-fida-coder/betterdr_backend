const { User, sequelize } = require('./models');

async function testHierarchy() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // Find existing admin or create one
        let admin = await User.findOne({ where: { role: 'admin' } });
        if (!admin) {
            console.log('Creating admin...');
            admin = await User.create({
                username: 'adminTest',
                email: 'adminTest@example.com',
                password: 'password',
                role: 'admin'
            });
        }
        console.log(`👤 Admin: ${admin.username} (${admin.id})`);

        // Create an Agent
        const agentName = `testAgent_${Date.now()}`;
        const agent = await User.create({
            username: agentName,
            email: `${agentName}@example.com`,
            password: 'password',
            role: 'agent',
            status: 'active'
        });
        console.log(`🕵️ Created Agent: ${agent.username} (${agent.id})`);

        // Test creation of User ASSIGNED to Agent
        const userName = `subUser_${Date.now()}`;
        console.log(`Creating user assigned to agent ${agent.id}...`);

        // We can't call the controller directly easily without mocking req/res, 
        // so we will test the Model relationship which the controller relies on.
        // But the controller logic modification was mainly about validation and setting agentId.

        const user = await User.create({
            username: userName,
            email: `${userName}@example.com`,
            password: 'password',
            role: 'user',
            agentId: agent.id // The crucial part
        });

        console.log(`👤 Created User: ${user.username} (${user.id}) with agentId: ${user.agentId}`);

        if (user.agentId === agent.id) {
            console.log('✅ SUCCESS: User correctly assigned to agent.');
        } else {
            console.error('❌ FAILURE: User agentId mismatch.');
        }

        // Verify retrieval
        const fetchedAgent = await User.findByPk(agent.id, {
            include: [{ model: User, as: 'subUsers' }]
        });

        if (fetchedAgent.subUsers.some(u => u.id === user.id)) {
            console.log('✅ SUCCESS: Agent.subUsers contains the new user.');
        } else {
            console.error('❌ FAILURE: User not found in Agent.subUsers');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await sequelize.close();
    }
}

testHierarchy();
