const { connectDB } = require('./config/database');
const Match = require('./models/Match');
const User = require('./models/User');
const Bet = require('./models/Bet');
const dotenv = require('dotenv');

dotenv.config();

const viewData = async () => {
    try {
        await connectDB();
        console.log('\n📊 === DATABASE SUMMARY ===');

        const userCount = await User.countDocuments();
        const betCount = await Bet.countDocuments();
        const matchCount = await Match.countDocuments();

        console.log(`👥 Users: ${userCount}`);
        console.log(`🎫 Bets: ${betCount}`);
        console.log(`⚽ Matches: ${matchCount}`);

        console.log('\n📅 === RECENT LIVE/SCORED MATCHES ===');
        const matches = await Match.find({
            $or: [
                { 'score.score_home': { $gt: 0 } },
                { 'score.score_away': { $gt: 0 } },
                { status: 'live' }
            ]
        }).limit(5).sort({ lastUpdated: -1 });

        if (matches.length === 0) {
            console.log('No matches with active scores found yet.');
        } else {
            matches.forEach(m => {
                const home = m.homeTeam;
                const away = m.awayTeam;
                const score = m.score || {};
                const sHome = score.score_home || score.scoreHome || 0;
                const sAway = score.score_away || score.scoreAway || 0;
                const status = m.status.toUpperCase();

                console.log(`[${status}] ${home} (${sHome}) vs ${away} (${sAway})`);
            });
        }

        console.log('\n=============================');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

viewData();
