const express = require('express');
const router = express.Router();
const { registerUser, loginUser, loginAdmin, loginAgent, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

const authLimiter = rateLimit({ windowMs: 60_000, max: 120 });

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/admin/login', authLimiter, loginAdmin);
router.post('/agent/login', authLimiter, loginAgent);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
