const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const API_KEY = process.env.ODDS_API_KEY;
const URL = 'https://api.the-odds-api.com/v4/sports/basketball_nba/scores'; // Use 'scores' endpoint

const testFetch = async () => {
    try {
        console.log('Testing /scores endpoint...');
        const response = await axios.get(URL, {
            params: {
                apiKey: API_KEY,
                daysFrom: 1, // Look for recent games
            }
        });

        console.log(`Status: ${response.status}`);
        const events = response.data;
        console.log(`Found ${events.length} events.`);

        if (events.length > 0) {
            const first = events[0];
            console.log('First Event Keys:', Object.keys(first));
            console.log('Scores:', first.scores || first.score);

            // Check for any event with scores
            const withScores = events.find(e => e.scores || e.score);
            if (withScores) {
                console.log('✅ Found event with scores:', withScores.home_team, withScores.scores || withScores.score);
            } else {
                console.log('❌ No scores found in response.');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.log(error.response.data);
    }
};

testFetch();
