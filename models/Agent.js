const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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

        role: {
            type: String,
            enum: ['agent', 'super_agent'],
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
