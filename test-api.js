const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.ODDS_API_KEY;
const URL = 'https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=' + API_KEY + '&regions=us&markets=h2h';

async function test() {
    console.log('Testing Odds API with key:', API_KEY);
    try {
        const response = await axios.get(URL);
        console.log('Success! Found', response.data.length, 'events');
        if (response.data.length > 0) {
            console.log('First event:', response.data[0].home_team, 'vs', response.data[0].away_team);
        }
    } catch (err) {
        console.error('API Error:', err.response ? err.response.data : err.message);
    }
}

test();
