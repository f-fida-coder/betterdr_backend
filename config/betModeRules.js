const DEFAULT_BET_MODE_RULES = [
    {
        mode: 'straight',
        minLegs: 1,
        maxLegs: 1,
        teaserPointOptions: [],
        payoutProfile: { type: 'odds_product' },
        isActive: true
    },
    {
        mode: 'parlay',
        minLegs: 2,
        maxLegs: 12,
        teaserPointOptions: [],
        payoutProfile: { type: 'odds_product' },
        isActive: true
    },
    {
        mode: 'teaser',
        minLegs: 2,
        maxLegs: 6,
        teaserPointOptions: [6, 6.5, 7],
        payoutProfile: {
            type: 'table_multiplier',
            multipliers: {
                '2': 1.8,
                '3': 2.6,
                '4': 4.0,
                '5': 6.5,
                '6': 9.5
            }
        },
        isActive: true
    },
    {
        mode: 'if_bet',
        minLegs: 2,
        maxLegs: 2,
        teaserPointOptions: [],
        payoutProfile: { type: 'odds_product' },
        isActive: true
    },
    {
        mode: 'reverse',
        minLegs: 2,
        maxLegs: 2,
        teaserPointOptions: [],
        payoutProfile: { type: 'odds_product' },
        isActive: true
    }
];

const normalizeBetMode = (mode) => String(mode || 'straight').toLowerCase().replace(/-/g, '_').trim();

const getDefaultBetModeRule = (mode) => {
    const normalizedMode = normalizeBetMode(mode);
    return DEFAULT_BET_MODE_RULES.find(rule => rule.mode === normalizedMode) || null;
};

module.exports = {
    DEFAULT_BET_MODE_RULES,
    normalizeBetMode,
    getDefaultBetModeRule
};
