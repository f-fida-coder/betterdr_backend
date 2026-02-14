const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            index: true,
        },
        agentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        amount: {
            type: mongoose.Decimal128,
            required: true,
            get: (value) => value ? value.toString() : '0.00',
        },
        type: {
            type: String,
            enum: ['deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_lost', 'bet_refund', 'adjustment', 'payment'],
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'completed',
            index: true,
        },

        balanceBefore: {
            type: mongoose.Decimal128,
            default: null,
            get: (value) => value ? value.toString() : null,
        },
        balanceAfter: {
            type: mongoose.Decimal128,
            default: null,
            get: (value) => value ? value.toString() : null,
        },
        reason: {
            type: String,
            default: null, // e.g., 'BET_WON', 'DEPOSIT_STRIPE'
        },
        referenceType: {
            type: String,
            enum: ['Bet', 'Payment', 'Adjustment', null],
            default: null,
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        stripePaymentId: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: null,
        },
        ipAddress: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
        metadata: {
            type: Map,
            of: String,
            default: {},
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual field for id (alias of _id) to maintain compatibility
transactionSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('Transaction', transactionSchema);
