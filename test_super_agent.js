const axios = require('axios');

// Configure these if running against a different environment
const API_URL = 'http://localhost:5000/api'; // Using port 5000 as per server.js

async function testSuperAgentFlow() {
    try {
        console.log('🚀 Starting Super Agent Flow Test...\n');

        // 1. Login as Admin
        console.log('1️⃣ Logging in as Admin...');
        let adminToken;
        try {
            const loginRes = await axios.post(`${API_URL}/auth/admin/login`, {
                username: 'fida',
                password: 'Fida47'
            });
            adminToken = loginRes.data.token;
            console.log('✅ Admin logged in.');
        } catch (e) {
            console.error('❌ Admin login failed:', e.response?.data || e.message);
            return;
        }

        // 2. Admin creates Super Agent
        console.log('\n2️⃣ Admin creating Super Agent...');
        const superAgentUsername = `master_${Date.now()}`;
        const superAgentPass = 'password123';
        let superAgentToken;

        try {
            // Note: Endpoint might differ based on api.js check, assuming /admin/create-agent with role or specific endpoint
            // Looking at previous patterns, simple agents are created via /admin/create-agent. 
            // We need to check if that endpoint handles super_agent role or if it's a different one.
            // Based on Agent.js model, role is 'agent' or 'super_agent'.
            // I will assume /admin/create-agent accepts 'role' in body or we need a specific route.
            // Let's try sending role: 'super_agent' to /admin/create-agent

            const createRes = await axios.post(
                `${API_URL}/admin/create-agent`,
                {
                    username: superAgentUsername,
                    password: superAgentPass,
                    phoneNumber: `555${Date.now().toString().slice(-7)}`,
                    fullName: 'Super Agent Test',
                    role: 'super_agent' // Explicitly requesting super_agent role
                },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            console.log(`✅ Super Agent created: ${superAgentUsername} (Role: super_agent expected)`);

        } catch (e) {
            console.error('❌ Failed to create Super Agent:', e.response?.data || e.message);
            return;
        }

        // 3. Login as Super Agent
        console.log('\n3️⃣ Logging in as Super Agent...');
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                username: superAgentUsername.toUpperCase(),
                password: superAgentPass
            });
            superAgentToken = loginRes.data.token;
            console.log('✅ Super Agent logged in.');
        } catch (e) {
            console.error('❌ Super Agent login failed:', e.response?.data || e.message);
            return;
        }

        // 4. Super Agent creates Sub-Agent
        console.log('\n4️⃣ Super Agent creating Sub-Agent...');
        const subAgentUsername = `sub_${Date.now()}`;
        try {
            const createSubRes = await axios.post(
                `${API_URL}/agent/create-sub-agent`, // This matches agentRoutes.js
                {
                    username: subAgentUsername,
                    password: 'password123',
                    phoneNumber: `555${Date.now().toString().slice(-7)}`,
                    fullName: 'Sub Agent Test'
                },
                { headers: { Authorization: `Bearer ${superAgentToken}` } }
            );
            console.log('✅ Sub-Agent created:', createSubRes.data.agent.username);
        } catch (e) {
            console.error('❌ Super Agent failed to create Sub-Agent:', e.response?.data || e.message);
        }

        // 5. Super Agent creates Player
        console.log('\n5️⃣ Super Agent creating Player...');
        const playerUsername = `player_${Date.now()}`;
        try {
            const createUserRes = await axios.post(
                `${API_URL}/agent/create-user`,
                {
                    username: playerUsername,
                    password: 'password123',
                    phoneNumber: `555${Date.now().toString().slice(-7)}`,
                    fullName: 'Player Under Super Agent'
                },
                { headers: { Authorization: `Bearer ${superAgentToken}` } }
            );
            console.log('✅ Player created:', createUserRes.data.user.username);
        } catch (e) {
            console.error('❌ Super Agent failed to create Player:', e.response?.data || e.message);
        }

        console.log('\n🏁 Super Agent Flow Test Complete.');

    } catch (error) {
        console.error('❌ Test failed with unexpected error:', error.message);
    }
}

testSuperAgentFlow();
