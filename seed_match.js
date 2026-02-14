const { Match } = require('./models');
const { connectDB, mongoose } = require('./config/database');
require('dotenv').config();

const seedMatch = async () => {
    try {
        await connectDB();
        console.log('Database connected.');

        const match = new Match({
            homeTeam: 'Lakers',
            awayTeam: 'Warriors',
            startTime: new Date(),
            status: 'live',
            sport: 'basketball',
            odds: {
                home_win: 1.90,
                away_win: 2.10,
                draw: 15.00
            },
            score: {
                home: 0,
                away: 0
            }
        });

        await match.save();
        console.log('Match created with ID:', match._id);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding match:', error);
        process.exit(1);
    }
};

seedMatch();
