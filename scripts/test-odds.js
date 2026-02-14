const dotenv = require('dotenv');
// Load environment variables immediately
dotenv.config();

const oddsService = require('../services/oddsService');
const { connectDB, mongoose } = require('../config/database');

const testOdds = async () => {
    try {
        console.log('🧪 Testing Odds Integration...');

        // Connect to MongoDB
        await connectDB();

        console.log('🔄 Fetching and updating odds...');
        // This will use the ODDS_API_KEY from .env
        const result = await oddsService.updateMatches();

        console.log('✅ Result:', result);

        // Optional: Check if any matches were actually saved
        const Match = require('../models/Match');
        const count = await Match.countDocuments();
        console.log(`📊 Total Matches in DB: ${count}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
};

testOdds();
