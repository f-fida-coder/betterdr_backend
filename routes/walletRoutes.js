const express = require('express');
const router = express.Router();
const { getBalance, deposit } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/balance', protect, getBalance);
router.get('/', protect, getBalance);
router.post('/deposit', protect, deposit);

module.exports = router;
