const express = require('express');
const router = express.Router();
const {
    getBalance,
    getTransactions,
    requestDeposit,
    requestWithdrawal,
    deposit
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/balance', protect, getBalance);
router.get('/', protect, getBalance);
router.get('/transactions', protect, getTransactions);
router.post('/request-deposit', protect, requestDeposit);
router.post('/request-withdrawal', protect, requestWithdrawal);
router.post('/deposit', protect, deposit);

module.exports = router;
