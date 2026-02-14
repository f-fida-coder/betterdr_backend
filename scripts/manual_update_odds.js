require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const oddsService = require('../services/oddsService');

const run = async () => {
    try {
        await connectDB();
        console.log('Testing Odds Update...');

        // This will call the REAL API if key is present
        const result = await oddsService.updateMatches();

        console.log('Update Result:', result);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        mongoose.connection.close();
    }
};

run();
