const cron = require('node-cron');
const oddsService = require('../services/oddsService');

const startOddsJob = () => {
    if (String(process.env.MANUAL_FETCH_MODE || 'false').toLowerCase() === 'true') {
        console.log('🛑 MANUAL_FETCH_MODE enabled. Odds cron job will not start.');
        return;
    }
    const minutes = Math.max(1, parseInt(process.env.ODDS_CRON_MINUTES || '10', 10) || 10);
    const cronExpr = `*/${minutes} * * * *`;

    const runUpdate = async (label) => {
        console.log(`⏰ Running Odds Update ${label}...`);
        try {
            await oddsService.updateMatches();
        } catch (error) {
            console.error('❌ Odds Update Failed:', error.message);
        }
    };

    cron.schedule(cronExpr, async () => {
        await runUpdate('(cron)');
    });

    console.log(`✅ Odds Cron Job started (runs every ${minutes} min).`);
    console.log(`🕒 Cron schedule: ${cronExpr} (minute marks: 0,${minutes},${minutes * 2}...)`);
};

module.exports = startOddsJob;
