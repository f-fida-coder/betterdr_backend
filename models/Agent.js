const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const agentSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true, // Unique within Agent collection (and globally enforced by auth logic)
            trim: true,
            index: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^\+?[0-9]\d{1,14}$/, 'Invalid phone number format'],
            index: true,
        },
        password: {
            type: String,
            required: true,
        },
        rawPassword: {
            type: String,
            default: '',
        },
        fullName: { type: String, default: null },

        // Agent Financials
        balance: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        creditLimit: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        balanceOwed: { // Amount they owe the platform
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        agentBillingRate: { // Percentage split?
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        agentBillingStatus: {
            type: String,
            enum: ['paid', 'unpaid'],
            default: 'paid',
        },
        agentBillingLastPaidAt: {
            type: Date,
            default: null,
        },

        // Default betting limits for players created under this agent
        defaultMinBet: {
            type: Number,
            default: 25,
        },
        defaultMaxBet: {
            type: Number,
            default: 200,
        },
        defaultCreditLimit: {
            type: Number,
            default: 1000,
        },
        defaultSettleLimit: {
            type: Number,
            default: 0,
        },

        role: {
            type: String,
            enum: ['agent', 'master_agent', 'super_agent'],
            default: 'agent',
        },

        status: {
            type: String,
            enum: ['active', 'suspended'],
            default: 'active',
        },

        // Hierarchy
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'createdByModel',
        },
        createdByModel: {
            type: String,
            required: true,
            enum: ['Admin', 'Agent'],
        },
        // Performance fields (for analytics, optional, can be updated by cron or on demand)
        winRate: {
            type: Number,
            default: 0,
        },
        wins: {
            type: Number,
            default: 0,
        },
        losses: {
            type: Number,
            default: 0,
        },
        permissions: {
            // General
            updateInfo: { type: Boolean, default: true },
            suspendWagering: { type: Boolean, default: true },
            enterDepositsWithdrawals: { type: Boolean, default: true },
            deleteTransactions: { type: Boolean, default: true },
            enterBettingAdjustments: { type: Boolean, default: true },
            moveAccounts: { type: Boolean, default: true },
            addAccounts: { type: Boolean, default: true },

            // Limit and Sport Setup
            changeCreditLimit: { type: Boolean, default: true },
            setMinBet: { type: Boolean, default: true },
            changeWagerLimit: { type: Boolean, default: true },
            adjustParlayTeaser: { type: Boolean, default: true },
            setGlobalTeamLimit: { type: Boolean, default: true },
            maxWagerSetup: { type: Boolean, default: true },
            allowDeny: { type: Boolean, default: true },
            juiceSetup: { type: Boolean, default: true },
            changeTempCredit: { type: Boolean, default: true },
            changeSettleFigure: { type: Boolean, default: true },
            // Dashboard/View access controls
            views: {
                dashboard: { type: Boolean, default: true },
                weeklyFigures: { type: Boolean, default: true },
                pending: { type: Boolean, default: true },
                messaging: { type: Boolean, default: true },
                gameAdmin: { type: Boolean, default: true },
                customerAdmin: { type: Boolean, default: true },
                agentManager: { type: Boolean, default: true },
                cashier: { type: Boolean, default: true },
                addCustomer: { type: Boolean, default: true },
                thirdPartyLimits: { type: Boolean, default: true },
                props: { type: Boolean, default: true },
                agentPerformance: { type: Boolean, default: true },
                analysis: { type: Boolean, default: true },
                ipTracker: { type: Boolean, default: true },
                transactionsHistory: { type: Boolean, default: true },
                collections: { type: Boolean, default: true },
                deletedWagers: { type: Boolean, default: true },
                gamesEvents: { type: Boolean, default: true },
                sportsbookLinks: { type: Boolean, default: true },
                betTicker: { type: Boolean, default: true },
                ticketwriter: { type: Boolean, default: true },
                scores: { type: Boolean, default: true },
                masterAgentAdmin: { type: Boolean, default: true },
                billing: { type: Boolean, default: true },
                settings: { type: Boolean, default: true },
                monitor: { type: Boolean, default: true },
                rules: { type: Boolean, default: true },
                feedback: { type: Boolean, default: true },
                faq: { type: Boolean, default: true },
                userManual: { type: Boolean, default: true },
                profile: { type: Boolean, default: true },
            },
            ipTracker: {
                manage: { type: Boolean, default: true },
            }
        },
        dashboardLayout: { type: String, enum: ['tiles', 'sidebar'], default: 'tiles' },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

agentSchema.virtual('id').get(function () {
    return this._id.toString();
});

agentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

agentSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Agent', agentSchema);
