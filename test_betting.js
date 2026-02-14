const http = require('http');

// Simple fetch wrapper since node-fetch might not be available
function request(url, method, body, headers = {}) {
    return new Promise((resolve, reject) => {
        // Parse URL
        const parsedUrl = new URL(url);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
    try {
        console.log('--- Starting Betting Engine Test ---');

        // 1. Register
        console.log('1. Registering User...');
        const userPayload = {
            username: `bettor_${Date.now()}`,
            email: `bettor_${Date.now()}@example.com`,
            password: 'password123'
        };

        let authRes = await request(`${BASE_URL}/auth/signup`, 'POST', userPayload);
        let token = authRes.data.token;

        if (!token) {
            console.log('Login required... reason:', JSON.stringify(authRes.data));
            authRes = await request(`${BASE_URL}/auth/login`, 'POST', { email: userPayload.email, password: userPayload.password });
            token = authRes.data.token;
        }

        if (!token) {
            console.log('Login failed response:', JSON.stringify(authRes.data));
            throw new Error('Auth failed');
        }

        if (!token) throw new Error('Auth failed');
        console.log('   User authenticated.');

        // 2. Deposit
        console.log('2. Depositing $1000...');
        const depositRes = await request(`${BASE_URL}/wallet/deposit`, 'POST', { amount: 1000 }, { 'Authorization': `Bearer ${token}` });
        if (depositRes.status !== 200) throw new Error('Deposit failed');
        console.log('   New Balance:', depositRes.data.balance);

        // 3. Place Bet
        // Assuming Match ID 1 exists from seed (or we can query DB, but hardcoding for quick test if we just ran seed)
        // Better: we can't easily query DB here without importing models. 
        // We will assume ID 1 or passed in arguments. Let's assume ID 1 is the first one created.
        const matchId = 3;

        console.log('3. Placing Bet on Lakers (Win) $100 @ 1.90...');
        const betPayload = {
            matchId: matchId,
            selection: 'Lakers',
            odds: 1.90,
            amount: 100,
            type: 'moneyline'
        };

        const betRes = await request(`${BASE_URL}/bets/place`, 'POST', betPayload, { 'Authorization': `Bearer ${token}` });
        if (betRes.status !== 201) {
            console.error('Bet Failed:', betRes.data);
            // If match 1 doesn't exist, we fail.
            // We'll hope seed worked.
        } else {
            console.log('   Bet Placed!', betRes.data);
            console.log('   Balance:', betRes.data.newBalance, 'Pending:', betRes.data.newPending);
        }

        // 4. Settle Match (Lakers Win)
        console.log('4. Settling Match (Lakers Win)...');
        const settlePayload = {
            matchId: matchId,
            winner: 'Lakers'
        };
        const settleRes = await request(`${BASE_URL}/bets/settle`, 'POST', settlePayload, { 'Authorization': `Bearer ${token}` }); // Settle might need auth? Yes, protected.
        console.log('   Settlement Result:', settleRes.data);

        // 5. Final Balance Check
        console.log('5. Checking Final Balance...');
        const walletRes = await request(`${BASE_URL}/wallet`, 'GET', null, { 'Authorization': `Bearer ${token}` });
        console.log('   Final Balance:', walletRes.data.balance);
        console.log('   Final Pending:', walletRes.data.pendingBalance);

        // Expected: 1000 - 100 + (100 * 1.90) = 900 + 190 = 1090.
        // Pending: 0.

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

runTest();
