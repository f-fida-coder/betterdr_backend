const express = require('express');
const router = express.Router();
const { createDepositIntent, handleWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Protected routes
router.post('/create-deposit-intent', protect, createDepositIntent);

// Public routes
router.post('/webhook', handleWebhook);

module.exports = router;
