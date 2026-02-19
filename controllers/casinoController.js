const axios = require('axios');
const { CasinoGame } = require('../models');

const CASINO_CATEGORIES = ['lobby', 'table_games', 'slots', 'video_poker', 'specialty_games'];

const DEFAULT_CASINO_GAMES = [
    // Table Games
    { name: 'Single Hand ($1-$100)', slug: 'single-hand-1-100', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#115e59', icon: 'fa-solid fa-diamond', isFeatured: true },
    { name: 'Single Hand ($1-$50)', slug: 'single-hand-1-50', category: 'table_games', minBet: 1, maxBet: 50, themeColor: '#0f766e', icon: 'fa-solid fa-diamond' },
    { name: 'Single Hand ($1-$25)', slug: 'single-hand-1-25', category: 'table_games', minBet: 1, maxBet: 25, themeColor: '#0f766e', icon: 'fa-solid fa-diamond' },
    { name: 'Baccarat', slug: 'baccarat', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#9f1239', icon: 'fa-solid fa-gem', isFeatured: true },
    { name: 'Double Zero Roulette', slug: 'double-zero-roulette', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#b91c1c', icon: 'fa-solid fa-dharmachakra' },
    { name: 'Single Zero Roulette', slug: 'single-zero-roulette', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#a16207', icon: 'fa-solid fa-circle-notch' },
    { name: 'Stud Poker', slug: 'stud-poker', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#7c3aed', icon: 'fa-solid fa-clover' },
    { name: 'Let it Ride Poker', slug: 'let-it-ride-poker', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#6d28d9', icon: 'fa-solid fa-cards' },
    { name: 'Flamingo Casino House-Way', slug: 'flamingo-casino-house-way', category: 'table_games', minBet: 1, maxBet: 200, themeColor: '#be123c', icon: 'fa-solid fa-feather-pointed' },
    { name: 'Three Card Poker', slug: 'three-card-poker', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#4c1d95', icon: 'fa-solid fa-cards' },
    { name: 'Craps', slug: 'craps', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#1d4ed8', icon: 'fa-solid fa-dice' },
    { name: 'Blackjack Double Exposure', slug: 'blackjack-double-exposure', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#065f46', icon: 'fa-solid fa-diamond' },
    { name: '6-Deck Blackjack', slug: '6-deck-blackjack', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#14532d', icon: 'fa-solid fa-crown' },
    { name: 'Spanish Blackjack', slug: 'spanish-blackjack', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#166534', icon: 'fa-solid fa-diamond' },
    { name: 'Blackjack VIP', slug: 'blackjack-vip', category: 'table_games', minBet: 10, maxBet: 250, themeColor: '#14532d', icon: 'fa-solid fa-crown' },
    { name: 'American Roulette', slug: 'american-roulette', category: 'table_games', minBet: 1, maxBet: 100, themeColor: '#b91c1c', icon: 'fa-solid fa-dharmachakra' },
    { name: 'Casino Holdem', slug: 'casino-holdem', category: 'table_games', minBet: 1, maxBet: 150, themeColor: '#7e22ce', icon: 'fa-solid fa-cards' },
    { name: 'Blackjack Pro', slug: 'blackjack-pro', category: 'table_games', minBet: 1, maxBet: 50, themeColor: '#0f766e', icon: 'fa-solid fa-diamond' },

    // Slots
    { name: 'Arabian Treasure', slug: 'arabian-treasure', category: 'slots', minBet: 0.3, maxBet: 30, themeColor: '#7e22ce', icon: 'fa-solid fa-scroll', isFeatured: true },
    { name: 'Tales of Terror', slug: 'tales-of-terror', category: 'slots', minBet: 0.01, maxBet: 25, themeColor: '#334155', icon: 'fa-solid fa-ghost' },
    { name: 'Halloween', slug: 'halloween', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#1d4ed8', icon: 'fa-solid fa-spider' },
    { name: 'BoggeyMan', slug: 'boggeyman', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#111827', icon: 'fa-solid fa-mask' },
    { name: 'Burlesque', slug: 'burlesque', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#be185d', icon: 'fa-solid fa-feather' },
    { name: 'City Animals', slug: 'city-animals', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#2563eb', icon: 'fa-solid fa-paw' },
    { name: 'Dino Gangsters', slug: 'dino-gangsters', category: 'slots', minBet: 0.3, maxBet: 30, themeColor: '#4d7c0f', icon: 'fa-solid fa-dragon' },
    { name: 'Five-Reel Bounty Hunter Slots', slug: 'five-reel-bounty-hunter-slots', category: 'slots', minBet: 0.01, maxBet: 45, themeColor: '#92400e', icon: 'fa-solid fa-hat-cowboy' },
    { name: 'Five-Reel Fruity Fortune Slots', slug: 'five-reel-fruity-fortune-slots', category: 'slots', minBet: 0.05, maxBet: 45, themeColor: '#ea580c', icon: 'fa-solid fa-lemon' },
    { name: 'Frosty s Christmas', slug: 'frosty-s-christmas', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#0891b2', icon: 'fa-solid fa-snowflake' },
    { name: 'Fruity Fortune mobile Slots', slug: 'fruity-fortune-mobile-slots', category: 'slots', minBet: 0.05, maxBet: 45, themeColor: '#fb923c', icon: 'fa-solid fa-lemon' },
    { name: 'Horoscope', slug: 'horoscope', category: 'slots', minBet: 0.01, maxBet: 30, themeColor: '#8b5cf6', icon: 'fa-solid fa-moon' },
    { name: 'Jurassic Age', slug: 'jurassic-age', category: 'slots', minBet: 0.01, maxBet: 40, themeColor: '#16a34a', icon: 'fa-solid fa-dragon' },
    { name: 'Mistress of the Sea', slug: 'mistress-of-the-sea', category: 'slots', minBet: 0.01, maxBet: 40, themeColor: '#0ea5e9', icon: 'fa-solid fa-water' },
    { name: 'Pirate s Revenge Slots', slug: 'pirates-revenge-slots', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#9a3412', icon: 'fa-solid fa-skull-crossbones' },
    { name: 'Railway Riches', slug: 'railway-riches', category: 'slots', minBet: 0.01, maxBet: 35, themeColor: '#1f2937', icon: 'fa-solid fa-train' },
    { name: 'Reels of Potions', slug: 'reels-of-potions', category: 'slots', minBet: 0.01, maxBet: 35, themeColor: '#7c3aed', icon: 'fa-solid fa-flask' },
    { name: 'Serpent s Treasure Slots', slug: 'serpents-treasure-slots', category: 'slots', minBet: 0.01, maxBet: 40, themeColor: '#15803d', icon: 'fa-solid fa-worm' },
    { name: 'Slot Comando', slug: 'slot-comando', category: 'slots', minBet: 0.01, maxBet: 45, themeColor: '#0369a1', icon: 'fa-solid fa-jet-fighter' },
    { name: 'Talisman Sorcery', slug: 'talisman-sorcery', category: 'slots', minBet: 0.01, maxBet: 45, themeColor: '#6d28d9', icon: 'fa-solid fa-hat-wizard' },
    { name: 'Throne s Conquest', slug: 'thrones-conquest', category: 'slots', minBet: 0.01, maxBet: 50, themeColor: '#ca8a04', icon: 'fa-solid fa-chess-queen' },
    { name: 'X-mas Gifts', slug: 'x-mas-gifts', category: 'slots', minBet: 0.01, maxBet: 25, themeColor: '#dc2626', icon: 'fa-solid fa-gift' },

    // Video Poker
    { name: 'Aces and Eights', slug: 'aces-and-eights', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#1d4ed8', icon: 'fa-solid fa-cards' },
    { name: 'Aces & Eights 5 Lines HTML5', slug: 'aces-eights-5-lines-html5', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#1e40af', icon: 'fa-solid fa-cards' },
    { name: 'Deuces and Joker', slug: 'deuces-and-joker', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#7c3aed', icon: 'fa-solid fa-cards' },
    { name: 'Deuces and Joker HTML5', slug: 'deuces-and-joker-html5', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#6d28d9', icon: 'fa-solid fa-cards' },
    { name: 'Deuces Wild', slug: 'deuces-wild', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#a21caf', icon: 'fa-solid fa-cards' },
    { name: 'Deuces Wild 25 Line', slug: 'deuces-wild-25-line', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#86198f', icon: 'fa-solid fa-cards' },
    { name: 'Deuces Wild 5 Lines HTML5', slug: 'deuces-wild-5-lines-html5', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#701a75', icon: 'fa-solid fa-cards' },
    { name: 'Double Bonus', slug: 'double-bonus', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#0f766e', icon: 'fa-solid fa-cards' },
    { name: 'Double Double Bonus', slug: 'double-double-bonus', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#115e59', icon: 'fa-solid fa-cards' },
    { name: 'Jacks or Better', slug: 'jacks-or-better', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#be123c', icon: 'fa-solid fa-cards' },
    { name: 'Jacks or Better 25 Line', slug: 'jacks-or-better-25-line', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#9f1239', icon: 'fa-solid fa-cards' },
    { name: 'Jacks or Better 5 Lines HTML5', slug: 'jacks-or-better-5-lines-html5', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#881337', icon: 'fa-solid fa-cards' },
    { name: 'Jokers Wild', slug: 'jokers-wild', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#4f46e5', icon: 'fa-solid fa-cards' },
    { name: 'Jokers Wild 25 Line', slug: 'jokers-wild-25-line', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#4338ca', icon: 'fa-solid fa-cards' },
    { name: 'Jokers Wild 5 Lines HTML5', slug: 'jokers-wild-5-lines-html5', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#3730a3', icon: 'fa-solid fa-cards' },
    { name: 'Bonus Poker', slug: 'bonus-poker', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#0ea5e9', icon: 'fa-solid fa-cards' },
    { name: 'Bonus Poker Deluxe', slug: 'bonus-poker-deluxe', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#0284c7', icon: 'fa-solid fa-cards' },
    { name: 'Tens or Better', slug: 'tens-or-better', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#2563eb', icon: 'fa-solid fa-cards' },
    { name: 'All American', slug: 'all-american', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#1d4ed8', icon: 'fa-solid fa-cards' },
    { name: 'Double Joker Poker', slug: 'double-joker-poker', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#9333ea', icon: 'fa-solid fa-cards' },
    { name: 'Triple Double Bonus', slug: 'triple-double-bonus', category: 'video_poker', minBet: 1, maxBet: 100, themeColor: '#6d28d9', icon: 'fa-solid fa-cards' },

    // Specialty Games
    { name: 'Video Keno', slug: 'video-keno', category: 'specialty_games', minBet: 1, maxBet: 100, themeColor: '#0ea5e9', icon: 'fa-solid fa-table-cells-large' }
].map((game, idx) => ({
    provider: 'internal',
    ...game,
    status: 'active',
    supportsDemo: true,
    sortOrder: idx + 1,
    tags: [game.category.replace('_', ' '), 'live casino'],
    metadata: {}
}));

const normalizeCategory = (value) => {
    const normalized = String(value || 'lobby').toLowerCase().trim();
    return CASINO_CATEGORIES.includes(normalized) ? normalized : 'lobby';
};

const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return parsed;
};

const ensureCasinoSeeded = async () => {
    const operations = DEFAULT_CASINO_GAMES.map((game) => ({
        updateOne: {
            filter: { slug: game.slug },
            update: { $setOnInsert: game },
            upsert: true
        }
    }));
    await CasinoGame.bulkWrite(operations, { ordered: false });
};

const toPublicGame = (game) => ({
    id: game._id,
    externalGameId: game.externalGameId || null,
    provider: game.provider,
    name: game.name,
    slug: game.slug,
    category: game.category,
    icon: game.icon,
    themeColor: game.themeColor,
    imageUrl: game.imageUrl,
    minBet: game.minBet,
    maxBet: game.maxBet,
    rtp: game.rtp,
    volatility: game.volatility,
    tags: game.tags || [],
    isFeatured: Boolean(game.isFeatured),
    status: game.status,
    supportsDemo: Boolean(game.supportsDemo),
    launchUrl: game.launchUrl || '',
    createdAt: game.createdAt,
    updatedAt: game.updatedAt
});

exports.getCasinoGames = async (req, res) => {
    try {
        await ensureCasinoSeeded();
        const category = String(req.query.category || 'lobby').toLowerCase().trim();
        const search = String(req.query.search || '').trim();
        const featured = String(req.query.featured || '').toLowerCase() === 'true';
        const includeAll = String(req.query.all || '').toLowerCase() === 'true' && req.user?.role !== 'user';
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 48));
        const skip = (page - 1) * limit;

        const query = {};
        if (!includeAll) query.status = 'active';
        if (category && category !== 'lobby') query.category = normalizeCategory(category);
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
                { provider: { $regex: search, $options: 'i' } }
            ];
        }
        if (featured) query.isFeatured = true;

        const [games, total] = await Promise.all([
            CasinoGame.find(query).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(limit),
            CasinoGame.countDocuments(query)
        ]);

        res.json({
            games: games.map(toPublicGame),
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(1, Math.ceil(total / limit))
            }
        });
    } catch (error) {
        console.error('Error fetching casino games:', error);
        res.status(500).json({ message: 'Server error fetching casino games' });
    }
};

exports.getCasinoCategories = async (_req, res) => {
    try {
        await ensureCasinoSeeded();
        const stats = await CasinoGame.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        const countsByCategory = stats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const categories = [
            { id: 'lobby', label: 'Lobby', count: Object.values(countsByCategory).reduce((sum, count) => sum + count, 0) },
            { id: 'table_games', label: 'Table Games', count: countsByCategory.table_games || 0 },
            { id: 'slots', label: 'Slots', count: countsByCategory.slots || 0 },
            { id: 'video_poker', label: 'Video Poker', count: countsByCategory.video_poker || 0 },
            { id: 'specialty_games', label: 'Specialty Games', count: countsByCategory.specialty_games || 0 }
        ];

        res.json({ categories });
    } catch (error) {
        console.error('Error fetching casino categories:', error);
        res.status(500).json({ message: 'Server error fetching casino categories' });
    }
};

exports.launchCasinoGame = async (req, res) => {
    try {
        const game = await CasinoGame.findById(req.params.id);
        if (!game) {
            return res.status(404).json({ message: 'Casino game not found' });
        }
        if (game.status !== 'active') {
            return res.status(400).json({ message: `Game is currently ${game.status}` });
        }

        const fallbackLaunch = `${process.env.CASINO_FALLBACK_URL || 'https://example.com/casino'}/${game.slug}`;
        const baseLaunchUrl = game.launchUrl && game.launchUrl.trim().length > 0 ? game.launchUrl : fallbackLaunch;

        const launchUrl = `${baseLaunchUrl}${baseLaunchUrl.includes('?') ? '&' : '?'}user=${encodeURIComponent(req.user.username)}&gameId=${encodeURIComponent(game._id.toString())}&ts=${Date.now()}`;

        res.json({
            game: toPublicGame(game),
            launchUrl
        });
    } catch (error) {
        console.error('Error launching casino game:', error);
        res.status(500).json({ message: 'Server error launching casino game' });
    }
};

exports.createCasinoGame = async (req, res) => {
    try {
        const payload = {
            provider: req.body.provider || 'internal',
            externalGameId: req.body.externalGameId || null,
            name: req.body.name,
            slug: req.body.slug,
            category: normalizeCategory(req.body.category),
            icon: req.body.icon || 'fa-solid fa-dice',
            themeColor: req.body.themeColor || '#0f5db3',
            imageUrl: req.body.imageUrl || '',
            launchUrl: req.body.launchUrl || '',
            minBet: safeNumber(req.body.minBet, 1),
            maxBet: safeNumber(req.body.maxBet, 100),
            rtp: req.body.rtp != null ? safeNumber(req.body.rtp, null) : null,
            volatility: req.body.volatility || null,
            tags: Array.isArray(req.body.tags) ? req.body.tags : [],
            isFeatured: Boolean(req.body.isFeatured),
            status: req.body.status || 'active',
            supportsDemo: Boolean(req.body.supportsDemo),
            sortOrder: safeNumber(req.body.sortOrder, 100),
            metadata: req.body.metadata || {}
        };

        if (!payload.name || !payload.slug) {
            return res.status(400).json({ message: 'name and slug are required' });
        }

        const created = await CasinoGame.create(payload);
        res.status(201).json(toPublicGame(created));
    } catch (error) {
        console.error('Error creating casino game:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Game slug already exists' });
        }
        res.status(500).json({ message: 'Server error creating casino game' });
    }
};

exports.updateCasinoGame = async (req, res) => {
    try {
        const updates = {};
        const fields = [
            'provider', 'externalGameId', 'name', 'slug', 'icon', 'themeColor', 'imageUrl', 'launchUrl',
            'volatility', 'tags', 'isFeatured', 'status', 'supportsDemo', 'metadata'
        ];
        fields.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });
        if (req.body.category !== undefined) updates.category = normalizeCategory(req.body.category);
        if (req.body.minBet !== undefined) updates.minBet = safeNumber(req.body.minBet, 1);
        if (req.body.maxBet !== undefined) updates.maxBet = safeNumber(req.body.maxBet, 100);
        if (req.body.sortOrder !== undefined) updates.sortOrder = safeNumber(req.body.sortOrder, 100);
        if (req.body.rtp !== undefined) updates.rtp = req.body.rtp == null ? null : safeNumber(req.body.rtp, null);

        const updated = await CasinoGame.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: 'Casino game not found' });
        res.json(toPublicGame(updated));
    } catch (error) {
        console.error('Error updating casino game:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Game slug already exists' });
        }
        res.status(500).json({ message: 'Server error updating casino game' });
    }
};

exports.syncCasinoGamesFromProvider = async (_req, res) => {
    try {
        const providerApiUrl = process.env.CASINO_PROVIDER_API_URL;
        if (!providerApiUrl) {
            return res.status(400).json({ message: 'CASINO_PROVIDER_API_URL is not configured' });
        }

        const providerToken = process.env.CASINO_PROVIDER_API_TOKEN;
        const response = await axios.get(providerApiUrl, {
            headers: providerToken ? { Authorization: `Bearer ${providerToken}` } : {}
        });

        const rawGames = Array.isArray(response.data) ? response.data : (Array.isArray(response.data?.games) ? response.data.games : []);
        if (rawGames.length === 0) {
            return res.status(400).json({ message: 'Provider response contained no games' });
        }

        const operations = rawGames
            .filter((game) => game && (game.id || game.externalGameId || game.slug || game.name))
            .map((game, idx) => {
                const provider = game.provider || 'provider_api';
                const slug = String(game.slug || game.name || game.id).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
                const externalGameId = game.externalGameId || game.id || null;
                const filter = externalGameId ? { provider, externalGameId } : { slug };

                return {
                    updateOne: {
                        filter,
                        update: {
                            $set: {
                                provider,
                                externalGameId,
                                name: game.name || slug,
                                slug,
                                category: normalizeCategory(game.category || 'lobby'),
                                icon: game.icon || 'fa-solid fa-dice',
                                themeColor: game.themeColor || '#0f5db3',
                                imageUrl: game.imageUrl || '',
                                launchUrl: game.launchUrl || '',
                                minBet: safeNumber(game.minBet, 1),
                                maxBet: safeNumber(game.maxBet, 100),
                                rtp: game.rtp != null ? safeNumber(game.rtp, null) : null,
                                volatility: game.volatility || null,
                                tags: Array.isArray(game.tags) ? game.tags : [],
                                isFeatured: Boolean(game.isFeatured),
                                status: game.status || 'active',
                                supportsDemo: Boolean(game.supportsDemo),
                                sortOrder: safeNumber(game.sortOrder, idx + 1),
                                metadata: game.metadata || {}
                            }
                        },
                        upsert: true
                    }
                };
            });

        if (operations.length === 0) {
            return res.status(400).json({ message: 'Provider payload could not be mapped to valid games' });
        }

        const result = await CasinoGame.bulkWrite(operations, { ordered: false });
        res.json({
            message: 'Casino games synced',
            matched: result.matchedCount || 0,
            modified: result.modifiedCount || 0,
            inserted: result.upsertedCount || 0
        });
    } catch (error) {
        console.error('Error syncing casino games:', error);
        res.status(500).json({ message: 'Server error syncing casino games' });
    }
};
