const express = require('express');
const router = express.Router();
const socketIo = require('../socket');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

// POST /api/debug/emit-match
router.post('/emit-match', protect, adminOnly, (req, res) => {
    try {
        const io = socketIo.getIo();
        const payload = req.body && Object.keys(req.body).length ? req.body : {
            id: 'debug-' + Date.now(),
            homeTeam: 'Debug Home',
            awayTeam: 'Debug Away',
            startTime: new Date().toISOString(),
            sport: 'debug',
            status: 'live',
            score: { score_home: 1, score_away: 2, period: 'Q2', event_status: 'STATUS_IN_PROGRESS' },
            odds: {}
        };

        io.emit('matchUpdate', payload);
        return res.json({ ok: true, emitted: payload });
    } catch (err) {
        console.error('Debug emit failed', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
