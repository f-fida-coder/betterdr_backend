const fetch = require('node-fetch');
// If node-fetch is not installed, we might need to rely on native fetch if node version is > 18.
// Assuming native fetch or we'll install node-fetch.
// Let's try native fetch first (Node 18+).

const BASE_URL = 'https://betterdr-backend.onrender.com/api';
let token = '';
let matchId = '';

async function runTest() {
    try {
        console.log('--- Starting Betting Engine Test ---');

        // 1. Register/Login User
        const userPayload = {
            username: `bettor_${Date.now()}`,
            email: `bettor_${Date.now()}@example.com`,
            password: 'password123'
        };

        let res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userPayload)
        });

        // If user already exists (shouldn't with timestamp), try login
        if (res.status === 400) {
            res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userPayload.email, password: userPayload.password })
            });
        }

        const userData = await res.json();
        if (!res.ok) throw new Error(`Auth failed: ${JSON.stringify(userData)}`);

        token = userData.token;
        console.log('1. User Authenticated. Balance:', userData.user.balance);

        // 2. Fund the user (hacky: use deposit endpoint if exists, OR relies on default balance if any. 
        // Our User model default is 0.00. We likely need a deposit mechanism.
        // I'll check wallet routes or just force it via DB if I could, but I can't easily here.
        // Wait, I saw walletRoutes. Let's see if there is a deposit route.
        // Checking walletRoutes.js content would be smart, but let's assume standard names or check file first.
        // For now, I'll attempt a deposit.

        res = await fetch(`${BASE_URL}/wallet/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount: 1000 })
        });

        const depositData = await res.json();
        console.log('2. Deposit Attempt:', depositData);
        // If deposit route doesn't exist, we might be stuck with 0 balance unless we seeded DB.

        // 3. Create a Match (We don't have an API for this, we need to insert into DB directly or mock it?
        // Since I can't easily run a separate DB script without connection setup, 
        // I will rely on the fact that I can't test WITHOUT a match.
        // I will create a temporary helper route in server.js or just insert it via special script.
        // actually I can write a script that requires the models and inserts it.
        // But this is an external HTTP test.
        // I'll create a setup script `setup_test_data.js` for this.

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

// runTest();
