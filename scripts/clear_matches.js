const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Match = require('../models/Match');

const clearMatches = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const result = await Match.deleteMany({});
        console.log(`🗑️  Deleted ${result.deletedCount} matches from the database.`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing matches:', error);
        process.exit(1);
    }
};

clearMatches();
