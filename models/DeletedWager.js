const mongoose = require('mongoose');

const deletedWagerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        betId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bet',
            default: null,
        },
        amount: {
            type: mongoose.Decimal128,
            required: true,
            get: (value) => (value ? value.toString() : '0.00'),
        },
        sport: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            default: 'Admin action',
        },
        status: {
            type: String,
            enum: ['deleted', 'restored'],
            default: 'deleted',
            index: true,
        },
        deletedAt: {
            type: Date,
            default: Date.now,
        },
        restoredAt: {
            type: Date,
            default: null,
        },
        restoredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

deletedWagerSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('DeletedWager', deletedWagerSchema);
