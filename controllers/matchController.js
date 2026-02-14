const Match = require('../models/Match');

// @desc    Get all matches
// @route   GET /api/matches
// @access  Public
const getMatches = async (req, res) => {
    try {
        const { status, active } = req.query;
        let filter = {};

        if (status) {
            const normalized = status.toString().toLowerCase();
            filter.status = normalized === 'active' ? 'live' : normalized;
        } else if (active && active.toString().toLowerCase() === 'true') {
            filter.status = 'live';
        }

        const matches = await Match.find(filter).sort({ startTime: 1 });
        res.json(matches);
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ message: 'Server Error fetching matches' });
    }
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Public
const getMatchById = async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);
        if (match) {
            res.json(match);
        } else {
            res.status(404).json({ message: 'Match not found' });
        }
    } catch (error) {
        console.error('Error fetching match:', error);
        res.status(500).json({ message: 'Server Error fetching match' });
    }
};

// @desc    Manual fetch odds (public)
// @route   POST /api/matches/fetch-odds
// @access  Public (rate limited)
const fetchOddsPublic = async (_req, res) => {
    try {
        const allowPublicRefresh = String(process.env.PUBLIC_ODDS_REFRESH || 'true').toLowerCase() === 'true';
        if (!allowPublicRefresh) {
            return res.status(403).json({ message: 'Public odds refresh is disabled' });
        }
        const oddsService = require('../services/oddsService');
        console.log('🧪 Manual odds fetch triggered by public refresh');
        const results = await oddsService.updateMatches({ source: 'public', forceFetch: true });
        res.json({ message: 'Manual odds fetch completed', results });
    } catch (error) {
        console.error('Error in manual public odds fetch:', error);
        res.status(500).json({ message: 'Server error manual odds fetch' });
    }
};

module.exports = {
    getMatches,
    getMatchById,
    fetchOddsPublic
};
