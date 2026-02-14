const axios = require('axios');
const { sequelize, User } = require('../models');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:5001/api';

async function testPaymentFlow() {
    try {
        console.log('Testing Database Connection...');
        await sequelize.authenticate();
        console.log('Database Connected.');

        // 1. Get a user or create one for testing
        let user = await User.findOne({ where: { email: 'test@example.com' } });
        if (!user) {
            console.log('Creating test user...');
            user = await User.create({
                username: 'testuser_payment',
                email: 'test@example.com',
                password: 'password123',
                role: 'user',
                balance: 100.00
            });
        }

        // Ensure user is active
        if (user.status !== 'active') {
            console.log('User is suspended, activating...');
            user.status = 'active';
            await user.save();
        }

        console.log(`Using user: ${user.email} (ID: ${user.id})`);

        // 2. Login to get token
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        console.log('Login successful, token obtained.');

        // 3. Create Deposit Intent
        console.log('Creating Deposit Intent ($50)...');
        try {
            const depositRes = await axios.post(
                `${API_URL}/payments/create-deposit-intent`,
                { amount: 50.00 },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (depositRes.data.clientSecret) {
                console.log('SUCCESS: Deposit Intent Created.');
                console.log('Client Secret:', depositRes.data.clientSecret);
            } else {
                console.error('FAILURE: No client secret returned.');
            }
        } catch (err) {
            console.error('FAILURE: Error creating deposit intent:', err.response ? err.response.data : err.message);
        }

        console.log('Test completed.');
        process.exit(0);
    } catch (error) {
        console.error('Test script error:', error);
        process.exit(1);
    }
}

testPaymentFlow();
