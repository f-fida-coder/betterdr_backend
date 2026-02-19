const { ManualSection, Faq } = require('../models');

const DEFAULT_TUTORIALS = [
    {
        title: 'Understanding Moneyline Bets',
        content: 'Moneyline is the simplest market. Pick the team/player to win outright. Favorites pay less, underdogs pay more.',
        order: 1,
        status: 'active'
    },
    {
        title: 'Spread Betting Fundamentals',
        content: 'Spread balances teams with handicap points. You win if your selection covers the line after handicap is applied.',
        order: 2,
        status: 'active'
    },
    {
        title: 'Totals (Over/Under) Strategy',
        content: 'Totals bet on combined score, not winner. Use pace, weather, injuries, and line movement to shape decisions.',
        order: 3,
        status: 'active'
    },
    {
        title: 'Parlay Risk and Reward',
        content: 'Parlays combine multiple legs for higher payout. All legs must win. Correlation and overexposure are key risks.',
        order: 4,
        status: 'active'
    },
    {
        title: 'Live Betting Execution',
        content: 'Live markets move fast. Track momentum, timeout windows, and implied probability shifts before placing bets.',
        order: 5,
        status: 'active'
    },
    {
        title: 'Responsible Bankroll Management',
        content: 'Use unit sizing and strict limits. Never chase losses. Build consistency with pre-defined staking rules.',
        order: 6,
        status: 'active'
    }
];

const DEFAULT_FAQS = [
    {
        question: 'How quickly are deposits reflected?',
        answer: 'Card and wallet deposits are usually instant after approval. Bank and blockchain methods depend on provider processing.',
        status: 'active',
        order: 1
    },
    {
        question: 'How long do withdrawals take?',
        answer: 'Withdrawal requests are queued for review. Typical timeline is same day to 3 business days, based on method and verification.',
        status: 'active',
        order: 2
    },
    {
        question: 'Why was my wager rejected?',
        answer: 'Wagers may be rejected due to odds changes, market closure, insufficient balance, or bet-type validation rules.',
        status: 'active',
        order: 3
    },
    {
        question: 'Can I edit or cancel an open support ticket?',
        answer: 'You can submit a follow-up message in the same support thread. Agent/Admin can update ticket status after review.',
        status: 'active',
        order: 4
    }
];

const ensureTutorialSeeded = async () => {
    const count = await ManualSection.countDocuments();
    if (count > 0) return;
    await ManualSection.insertMany(DEFAULT_TUTORIALS);
};

const ensureFaqSeeded = async () => {
    const count = await Faq.countDocuments();
    if (count > 0) return;
    await Faq.insertMany(DEFAULT_FAQS);
};

exports.getTutorials = async (_req, res) => {
    try {
        await ensureTutorialSeeded();
        const tutorials = await ManualSection.find({ status: 'active' }).sort({ order: 1, createdAt: -1 });
        res.json({ tutorials });
    } catch (error) {
        console.error('Error fetching tutorials:', error);
        res.status(500).json({ message: 'Server error fetching tutorials' });
    }
};

exports.getSupportFaqs = async (_req, res) => {
    try {
        await ensureFaqSeeded();
        const faqs = await Faq.find({ status: 'active' }).sort({ order: 1, createdAt: -1 });
        res.json({ faqs });
    } catch (error) {
        console.error('Error fetching support FAQs:', error);
        res.status(500).json({ message: 'Server error fetching support FAQs' });
    }
};
