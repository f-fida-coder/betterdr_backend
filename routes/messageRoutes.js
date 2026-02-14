const express = require('express');
const router = express.Router();
const { createMessage, getMyMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createMessage);
router.get('/me', protect, getMyMessages);

module.exports = router;
