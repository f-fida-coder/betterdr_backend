const {
    User,
    Bet,
    Match,
    ThirdPartyLimit,
    Collection,
    DeletedWager,
    SportsbookLink,
    BillingInvoice,
    PlatformSetting,
    Rule,
    Feedback,
    Faq,
    ManualSection
} = require('./models');
const { connectDB } = require('./config/database');
require('dotenv').config();

const seedAdminDashboardDemo = async () => {
    try {
        await connectDB();

        let agent = await User.findOne({ username: 'demo_agent', role: 'agent' });
        if (!agent) {
            agent = await User.create({
                username: 'demo_agent',
                email: 'demo_agent@example.com',
                password: 'demo1234',
                role: 'agent',
                status: 'active'
            });
        }

        let customer = await User.findOne({ username: 'demo_customer', role: 'user' });
        if (!customer) {
            customer = await User.create({
                username: 'demo_customer',
                email: 'demo_customer@example.com',
                password: 'demo1234',
                role: 'user',
                status: 'active',
                agentId: agent._id
            });
        }

        let match = await Match.findOne({ homeTeam: 'Demo Hawks', awayTeam: 'Demo Kings' });
        if (!match) {
            match = await Match.create({
                homeTeam: 'Demo Hawks',
                awayTeam: 'Demo Kings',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                sport: 'basketball',
                status: 'scheduled'
            });
        }

        const existingBet = await Bet.findOne({ userId: customer._id, matchId: match._id });
        if (!existingBet) {
            await Bet.create({
                userId: customer._id,
                matchId: match._id,
                amount: 50,
                odds: 1.9,
                type: 'straight',
                selection: 'Demo Hawks ML',
                potentialPayout: 95,
                status: 'pending'
            });
        }

        const existingLimit = await ThirdPartyLimit.findOne({ provider: 'Demo Provider' });
        if (!existingLimit) {
            await ThirdPartyLimit.create({
                provider: 'Demo Provider',
                dailyLimit: 0,
                monthlyLimit: 0,
                used: 0,
                status: 'active'
            });
        }

        const existingCollection = await Collection.findOne({ userId: customer._id });
        if (!existingCollection) {
            await Collection.create({
                userId: customer._id,
                amount: 250,
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                status: 'pending',
                attempts: 0,
                notes: 'Demo collection',
                createdBy: agent._id
            });

            await Collection.create({
                userId: customer._id,
                amount: 120,
                dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                status: 'overdue',
                attempts: 1,
                notes: 'Overdue demo collection',
                createdBy: agent._id
            });
        }

        const existingDeleted = await DeletedWager.findOne({ userId: customer._id });
        if (!existingDeleted) {
            await DeletedWager.create({
                userId: customer._id,
                amount: 75,
                sport: 'NBA',
                reason: 'Demo cancellation',
                status: 'deleted'
            });
        }

        const existingLink = await SportsbookLink.findOne({ name: 'Demo Sportsbook' });
        if (!existingLink) {
            await SportsbookLink.create({
                name: 'Demo Sportsbook',
                url: 'https://api.demo-sportsbook.com',
                status: 'active',
                lastSync: new Date(),
                notes: 'Demo link',
                createdBy: agent._id
            });
        }

        const extraMatch = await Match.findOne({ homeTeam: 'Demo Raptors', awayTeam: 'Demo Bulls' });
        if (!extraMatch) {
            await Match.create({
                homeTeam: 'Demo Raptors',
                awayTeam: 'Demo Bulls',
                startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
                sport: 'basketball',
                status: 'scheduled',
                score: { scoreHome: 0, scoreAway: 0 },
                odds: { home: 1.9, away: 2.1 },
                lastUpdated: new Date()
            });
        }

        const existingInvoice = await BillingInvoice.findOne({ invoiceNumber: 'INV-DEMO-001' });
        if (!existingInvoice) {
            await BillingInvoice.create({
                invoiceNumber: 'INV-DEMO-001',
                amount: 5000,
                status: 'paid',
                paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                notes: 'Demo paid invoice',
                createdBy: agent._id
            });

            await BillingInvoice.create({
                invoiceNumber: 'INV-DEMO-002',
                amount: 2400,
                status: 'pending',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                notes: 'Demo pending invoice',
                createdBy: agent._id
            });
        }

        const existingSettings = await PlatformSetting.findOne();
        if (!existingSettings) {
            await PlatformSetting.create({
                platformName: 'Sports Betting Platform',
                dailyBetLimit: 10000,
                weeklyBetLimit: 50000,
                maxOdds: 100,
                minBet: 1,
                maxBet: 5000,
                maintenanceMode: false,
                emailNotifications: true,
                twoFactor: true
            });
        }

        const existingRule = await Rule.findOne({ title: 'Betting Rules' });
        if (!existingRule) {
            await Rule.create({
                title: 'Betting Rules',
                items: [
                    'Minimum bet amount: $1.00',
                    'Maximum bet amount: $5,000.00',
                    'Maximum odds allowed: 100.00',
                    'Bets must be placed before match start',
                    'Cash-out allowed for live bets'
                ],
                status: 'active'
            });
        }

        const existingFeedback = await Feedback.findOne({ userLabel: 'Demo User' });
        if (!existingFeedback) {
            await Feedback.create({
                userLabel: 'Demo User',
                message: 'Great platform! Love the interface.',
                rating: 5,
                status: 'new'
            });
        }

        const existingFaq = await Faq.findOne({ question: 'How do I create an account?' });
        if (!existingFaq) {
            await Faq.create({
                question: 'How do I create an account?',
                answer: 'Click on Register and fill in your details. Verify your email and you\'re all set!',
                status: 'active',
                order: 1
            });
        }

        const existingManual = await ManualSection.findOne({ title: 'Getting Started' });
        if (!existingManual) {
            await ManualSection.create({
                title: 'Getting Started',
                content: 'Welcome to the Sports Betting Admin Panel. This guide will help you navigate and manage the platform.',
                order: 1,
                status: 'active'
            });
        }

        console.log('✅ Seeded demo data for admin dashboard.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding admin dashboard demo data:', error);
        process.exit(1);
    }
};

seedAdminDashboardDemo();
