const mongoose = require('mongoose');
const Match = require('./models/Match');
const { connectDB } = require('./config/database');
require('dotenv').config();

const inspectMatches = async () => {
    try {
        await connectDB();
        console.log('Connected to DB');

        const matches = await Match.find({});
        console.log(`Found ${matches.length} matches.`);

        matches.forEach(m => {
            console.log('------------------------------------------------');
            console.log(`ID: ${m._id}`);
            console.log(`Sport: ${m.sport}`);
            console.log(`Teams: ${m.homeTeam} vs ${m.awayTeam}`);
            console.log(`Status: ${m.status}`);
            console.log(`Score:`, JSON.stringify(m.score));
            console.log(`Odds:`, JSON.stringify(m.odds));
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

inspectMatches();
