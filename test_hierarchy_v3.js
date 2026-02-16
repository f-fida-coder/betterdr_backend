const axios = require('axios');

const API_URL = 'https://betterdr-backend.onrender.com/api';

async function testHierarchy() {
    try {
        console.log('🧪 Starting Hierarchy Test...\n');

        // 1. Admin Login (assuming admin/admin123 exists or created via seed)
        console.log('1️⃣ Logging in as Admin...');
        let adminToken;
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                username: 'admin',
                password: 'admin123'
            });
            adminToken = loginRes.data.token;
            console.log('✅ Admin logged in.');
        } catch (e) {
            console.log('⚠️  Admin login failed. Trying to register admin (test only)...');
            // This might fail if admin creation is restricted, but worth a shot for local dev
            // Actually authController doesn't allow creating 'admin' via public register.
            // We assume 'admin' exists. If not, this test will fail here.
            console.error('❌ Admin login failed:', e.response?.data || e.message);
            return;
        }

        // 2. Admin Creates Agent
        console.log('\n2️⃣ Admin creating Agent...');
        const agentUsername = `agent_${Date.now()}`;
        const agentEmail = `${agentUsername}@test.com`;
        let agentId;
        let agentToken;

        try {
            const createAgentRes = await axios.post(
                `${API_URL}/admin/create-agent`,
                {
                    username: agentUsername,
                    email: agentEmail,
                    password: 'password123',
                    fullName: 'Test Agent'
                },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            console.log('✅ Agent created:', createAgentRes.data.agent.username);
            agentId = createAgentRes.data.agent.id;
        } catch (e) {
            console.error('❌ Failed to create agent:', e.response?.data || e.message);
        }

        // 3. Login as Agent
        console.log('\n3️⃣ Logging in as the new Agent...');
        try {
            const agentLoginRes = await axios.post(`${API_URL}/auth/login`, {
                username: agentUsername,
                password: 'password123'
            });
            agentToken = agentLoginRes.data.token;
            console.log('✅ Agent logged in.');
        } catch (e) {
            console.error('❌ Agent login failed:', e.response?.data || e.message);
            return;
        }

        // 4. Agent Creates User
        console.log('\n4️⃣ Agent creating User...');
        const userUsername = `user_${Date.now()}`;
        try {
            const createUserRes = await axios.post(
                `${API_URL}/agent/create-user`,
                {
                    username: userUsername,
                    email: `${userUsername}@test.com`,
                    password: 'password123',
                    fullName: 'Test User under Agent'
                },
                { headers: { Authorization: `Bearer ${agentToken}` } }
            );
            console.log('✅ User created under Agent:', createUserRes.data.user.username);
            console.log(`   User agentId: ${createUserRes.data.user.agentId} (Should verify this matches Agent ID)`);
        } catch (e) {
            console.error('❌ Agent failed to create user:', e.response?.data || e.message);
        }

        // 5. Agent Accessing Agent Dashboard
        console.log('\n5️⃣ Agent checking Dashboard/Stats...');
        try {
            const statsRes = await axios.get(
                `${API_URL}/agent/stats`,
                { headers: { Authorization: `Bearer ${agentToken}` } }
            );
            console.log('✅ Agent stats retrieved:', statsRes.data);
        } catch (e) {
            console.error('❌ Agent failed to get stats:', e.response?.data || e.message);
        }

        // 6. Access Control Check: Agent trying to create another Agent (Admin only)
        console.log('\n6️⃣ Access Control: Agent trying to create another Admin/Agent (Should Fail)...');
        try {
            await axios.post(
                `${API_URL}/admin/create-agent`,
                { username: 'fail', email: 'fail@test.com', password: '123' },
                { headers: { Authorization: `Bearer ${agentToken}` } }
            );
            console.error('❌ Security Breach: Agent was able to access /admin/create-agent!');
        } catch (e) {
            if (e.response && e.response.status === 403) {
                console.log('✅ Access denied as expected (403 Forbidden).');
            } else {
                console.log(`❓ Unexpected error code: ${e.response?.status}`);
            }
        }

        console.log('\n🏁 Test Complete.');

    } catch (error) {
        console.error('❌ Test failed with unexpected error:', error.message);
    }
}

testHierarchy();
