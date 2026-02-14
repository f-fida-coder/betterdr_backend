const { connectDB, mongoose } = require('./config/database');
const Match = require('./models/Match');
const dotenv = require('dotenv');
dotenv.config();

const inspectMatches = async () => {
    try {
        await connectDB();

        // Find a few matches, specifically NBA or NHL where live games happen
        const matches = await Match.find({
            sport: { $in: ['basketball_nba', 'icehockey_nhl', 'americanfootball_nfl'] }
        }).limit(5).sort({ startTime: 1 }); // Sort by time to see recent/upcoming

        console.log('🔍 Inspecting 5 Matches from DB:');
        matches.forEach(m => {
            console.log(`\nID: ${m.externalId}`);
            console.log(`Match: ${m.homeTeam} vs ${m.awayTeam}`);
            console.log(`Status: ${m.status}`);
            console.log(`Score:`, m.score);
            console.log(`Last Updated: ${m.lastUpdated}`);
        });

        // Check for ANY match with non-zero score
        const liveMatch = await Match.findOne({
            $or: [
                { 'score.score_home': { $gt: 0 } },
                { 'score.score_away': { $gt: 0 } }
            ]
        });

        if (liveMatch) {
            console.log('\n✅ Found at least one match with scores:');
            console.log(`${liveMatch.homeTeam} vs ${liveMatch.awayTeam} (${liveMatch.score.score_home}-${liveMatch.score.score_away})`);
        } else {
            console.log('\n❌ No matches found with score > 0');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

inspectMatches();
