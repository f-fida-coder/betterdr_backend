const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTutorials, getSupportFaqs } = require('../controllers/contentController');

router.get('/tutorials', protect, getTutorials);
router.get('/faqs', protect, getSupportFaqs);

module.exports = router;
