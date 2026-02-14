const express = require('express');
const router = express.Router();
const betController = require('../controllers/betController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

// Place a bet - Protected
router.post('/place', protect, betController.placeBet);

// Settle a match (Manual/Admin trigger for now)
router.post('/settle', protect, adminOnly, betController.settleMatch);

// Get My Bets - Protected
router.get('/my-bets', protect, betController.getMyBets);

module.exports = router;
