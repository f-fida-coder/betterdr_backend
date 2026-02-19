const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getCasinoGames,
    getCasinoCategories,
    launchCasinoGame,
    createCasinoGame,
    updateCasinoGame,
    syncCasinoGamesFromProvider
} = require('../controllers/casinoController');

const canManageCasino = authorize('admin', 'agent', 'master_agent', 'super_agent');

router.get('/games', protect, getCasinoGames);
router.get('/categories', protect, getCasinoCategories);
router.post('/games/:id/launch', protect, launchCasinoGame);

router.post('/admin/games', protect, canManageCasino, createCasinoGame);
router.put('/admin/games/:id', protect, canManageCasino, updateCasinoGame);
router.post('/admin/sync', protect, canManageCasino, syncCasinoGamesFromProvider);

module.exports = router;
