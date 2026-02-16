const axios = require('axios');
const mongoose = require('mongoose');

const API_URL = 'https://betterdr-backend.onrender.com/api';

// Helper to print step headers
const printStep = (step, title) => {
    console.log(`\n👉 \x1b[36mStep ${step}: ${title}\x1b[0m`);
};

// Helper to print results
const printResult = (success, message, data = null) => {
    if (success) {
        console.log(`   ✅ \x1b[32mSUCCESS:\x1b[0m ${message}`);
    } else {
        console.log(`   ❌ \x1b[31mFAILED:\x1b[0m ${message}`);
    }
    if (data) console.log('      Details:', JSON.stringify(data, null, 2));
};

async function testHierarchyV4() {
    try {
        console.log('\x1b[1m🧪 Starting Hierarchy Test V4 (Admin -> Agent -> User -> Bet)\x1b[0m');

        // =========================================================================
        // 1. Admin Login
        // =========================================================================
        printStep(1, 'Admin Login');
        let adminToken;
        try {
            // Using default seeded admin credentials: fida / Fida47
            const loginRes = await axios.post(`${API_URL}/auth/admin/login`, {
                username: 'fida',
                password: 'Fida47'
            });
            adminToken = loginRes.data.token;
            printResult(true, `Logged in as Admin: ${loginRes.data.username}`);

            if (loginRes.data.unlimitedBalance) {
                printResult(true, 'Admin has unlimited balance flag set.');
            } else {
                printResult(false, 'Admin unlimitedBalance flag is missing/false.');
            }
        } catch (e) {
            printResult(false, 'Admin login failed', e.response?.data || e.message);
            return;
        }

        // =========================================================================
        // 2. Admin Creates Agent
        // =========================================================================
        printStep(2, 'Admin Creates New Agent');
        const agentUsername = `agent_v4_${Date.now()}`;
        const agentEmail = `${agentUsername}@test.com`;
        const agentPassword = 'password123';
        let agentId;

        try {
            const createAgentRes = await axios.post(
                `${API_URL}/admin/create-agent`,
                {
                    username: agentUsername,
                    email: agentEmail,
                    password: agentPassword,
                    fullName: 'Test Agent V4'
                },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            agentId = createAgentRes.data.agent.id;
            printResult(true, `Agent created: ${createAgentRes.data.agent.username} (ID: ${agentId})`);
        } catch (e) {
            printResult(false, 'Failed to create agent', e.response?.data || e.message);
            return;
        }

        // =========================================================================
        // 3. Admin Assigns Balance to Agent
        // =========================================================================
        printStep(3, 'Admin Assigns Balance to Agent');
        try {
            // Check balance update endpoint
            const updateRes = await axios.put(
                `${API_URL}/admin/agent/${agentId}`,
                {
                    balance: 5000,
                    agentBillingRate: 0.1
                },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            printResult(true, `Agent balance updated to: ${updateRes.data.agent.balance}`);
        } catch (e) {
            printResult(false, 'Failed to update agent balance', e.response?.data || e.message);
        }

        // =========================================================================
        // 4. Agent Login
        // =========================================================================
        printStep(4, 'Agent Login');
        let agentToken;
        try {
            const agentLoginRes = await axios.post(`${API_URL}/auth/agent/login`, {
                username: agentUsername,
                password: agentPassword
            });
            agentToken = agentLoginRes.data.token;
            printResult(true, `Logged in as Agent: ${agentLoginRes.data.username}`);
            printResult(true, `Agent sees balance: ${agentLoginRes.data.balance}`);
        } catch (e) {
            printResult(false, 'Agent login failed', e.response?.data || e.message);
            return;
        }

        // =========================================================================
        // 5. Agent Creates User
        // =========================================================================
        printStep(5, 'Agent Creates User');
        const userUsername = `user_v4_${Date.now()}`;
        const userPassword = 'password123';
        let userId;

        try {
            const createUserRes = await axios.post(
                `${API_URL}/agent/create-user`,
                {
                    username: userUsername,
                    email: `${userUsername}@test.com`,
                    password: userPassword,
                    fullName: 'Test User V4',
                    balance: 0 // Start with 0 to test assignment next
                },
                { headers: { Authorization: `Bearer ${agentToken}` } }
            );
            userId = createUserRes.data.user.id;
            printResult(true, `User created: ${createUserRes.data.user.username} (ID: ${userId})`);
        } catch (e) {
            printResult(false, 'Failed to create user', e.response?.data || e.message);
            return;
        }

        // =========================================================================
        // 6. Agent Assigns Balance to User
        // =========================================================================
        printStep(6, 'Agent Assigns Balance to User');
        try {
            // Using update-balance-owed endpoint which handles manual adjustments by agent
            const balanceRes = await axios.post(
                `${API_URL}/agent/update-balance-owed`,
                {
                    userId: userId,
                    balance: 1000 // Set user balance to 1000
                },
                { headers: { Authorization: `Bearer ${agentToken}` } }
            );
            printResult(true, `User balance updated to: ${balanceRes.data.user.balance}`);
        } catch (e) {
            printResult(false, 'Failed to assign balance to user', e.response?.data || e.message);
        }

        // =========================================================================
        // 7. User Login & Place Bet
        // =========================================================================
        printStep(7, 'User Login & Place Bet');
        let userToken;
        try {
            const userLoginRes = await axios.post(`${API_URL}/auth/login`, {
                username: userUsername,
                password: userPassword
            });
            userToken = userLoginRes.data.token;
            printResult(true, `Logged in as User: ${userLoginRes.data.username}`);

            // Get a live or scheduled match to bet on
            const matchesRes = await axios.get(`${API_URL}/matches`);
            const match = matchesRes.data.find(m => m.status === 'scheduled' || m.status === 'live');

            if (!match) {
                printResult(false, 'No available matches to bet on.');
            } else {
                // Find valid odds
                let validOdds = null;
                let selection = match.homeTeam;

                // Try to find moneyline market
                // Logic adapted from betController to ensure we send what it expects
                const markets = match.odds && match.odds.markets ? match.odds.markets : [];
                const h2h = markets.find(m => ['h2h', 'moneyline', 'ml'].includes(m.key));

                if (h2h && h2h.outcomes) {
                    const outcome = h2h.outcomes.find(o => o.name === selection);
                    if (outcome) validOdds = outcome.price;
                }

                // Fallback to flat odds object if markets array structure isn't there (legacy/seed data)
                if (!validOdds && match.odds) {
                    if (match.odds.home_win || match.odds.homeWin || match.odds.home) {
                        validOdds = match.odds.home_win || match.odds.homeWin || match.odds.home;
                    }
                }

                if (!validOdds) {
                    printResult(false, `Could not find valid odds for match: ${match.homeTeam} vs ${match.awayTeam}`);
                    // Fallback to hardcoded just in case, but print warning
                    validOdds = 1.90;
                }

                // Place bet
                const betAmount = 100;
                const betRes = await axios.post(
                    `${API_URL}/bets/place`,
                    {
                        matchId: match._id,
                        selection: selection,
                        odds: Number(validOdds),
                        amount: betAmount,
                        type: 'moneyline'
                    },
                    { headers: { Authorization: `Bearer ${userToken}` } }
                );

                printResult(true, `Bet placed: $${betAmount} on ${selection} @ ${validOdds}`);
                printResult(true, `New Balance: ${betRes.data.balance}, Pending: ${betRes.data.pendingBalance}`);

                // Check if balance is roughly correct (allowing for float precision)
                if (Math.abs(betRes.data.balance - 900) < 0.1 && Math.abs(betRes.data.pendingBalance - 100) < 0.1) {
                    printResult(true, 'Balance calculations correct (1000 - 100 = 900)');
                } else {
                    printResult(false, `Balance mismatch! Expected 900/100, got ${betRes.data.balance}/${betRes.data.pendingBalance}`);
                }
            }
        } catch (e) {
            printResult(false, 'User betting flow failed', e.response?.data || e.message);
        }

        // =========================================================================
        // 8. Verify Stats (Optional)
        // =========================================================================
        printStep(8, 'Verify Agent Stats');
        try {
            const statsRes = await axios.get(
                `${API_URL}/agent/stats`,
                { headers: { Authorization: `Bearer ${agentToken}` } }
            );
            printResult(true, 'Agent Stats:', statsRes.data);
            if (statsRes.data.totalBets >= 1 && statsRes.data.totalWagered >= 100) {
                printResult(true, 'Agent stats reflect the user bet.');
            } else {
                printResult(false, 'Agent stats do NOT reflect the user bet.');
            }
        } catch (e) {
            printResult(false, 'Failed to fetch agent stats', e.response?.data || e.message);
        }

        console.log('\n\x1b[1m🏁 Test Complete V4\x1b[0m');

    } catch (error) {
        console.error('❌ Test script error:', error);
    }
}

testHierarchyV4();
