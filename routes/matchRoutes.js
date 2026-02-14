const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const rateLimit = require('../middleware/rateLimit');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

const publicFetchLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

router.get('/', matchController.getMatches);
router.post('/fetch-odds', publicFetchLimiter, matchController.fetchOddsPublic);
router.get('/:id', matchController.getMatchById);

module.exports = router;
