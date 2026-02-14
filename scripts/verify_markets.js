const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Match = require('../models/Match');

const verifyMarkets = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const matches = await Match.find({});
        console.log(`📊 Total Matches in DB: ${matches.length}`);

        let hasSpreads = 0;
        let hasTotals = 0;
        let hasH2h = 0;

        matches.forEach(m => {
            const markets = m.odds?.markets || [];
            if (markets.some(mk => mk.key === 'h2h')) hasH2h++;
            if (markets.some(mk => mk.key === 'spreads')) hasSpreads++;
            if (markets.some(mk => mk.key === 'totals')) hasTotals++;
        });

        console.log(`📈 Stats:`);
        console.log(`   - H2H (Moneyline): ${hasH2h}`);
        console.log(`   - Spreads:         ${hasSpreads}`);
        console.log(`   - Totals:          ${hasTotals}`);

        if (hasSpreads === 0 && matches.length > 0) {
            console.warn('⚠️  No spreads found. Ensure backend was restarted and data was refreshed.');
        } else if (hasSpreads > 0) {
            console.log('🎉 Success! Spreads are being stored.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

verifyMarkets();
