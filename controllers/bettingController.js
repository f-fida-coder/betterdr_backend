const { BetModeRule } = require('../models');
const { DEFAULT_BET_MODE_RULES } = require('../config/betModeRules');

const ensureBetModeRulesSeeded = async () => {
    await Promise.all(
        DEFAULT_BET_MODE_RULES.map((rule) =>
            BetModeRule.updateOne(
                { mode: rule.mode },
                { $setOnInsert: rule },
                { upsert: true }
            )
        )
    );
};

exports.getPublicBetModeRules = async (_req, res) => {
    try {
        await ensureBetModeRulesSeeded();
        const rules = await BetModeRule.find({ isActive: true }).sort({ mode: 1 });
        res.json({ rules });
    } catch (error) {
        console.error('Error fetching public bet mode rules:', error);
        res.status(500).json({ message: 'Server error fetching bet mode rules' });
    }
};
