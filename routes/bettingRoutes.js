const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPublicBetModeRules } = require('../controllers/bettingController');

router.get('/rules', protect, getPublicBetModeRules);

module.exports = router;
