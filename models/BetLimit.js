const mongoose = require('mongoose');

const betLimitSchema = new mongoose.Schema(
    {
        sportType: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        marketType: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        minStake: {
            type: Number,
            default: 1.00,
            min: 0.01,
        },
        maxStake: {
            type: Number,
            default: 10000.00,
            min: 1.00,
        },
        maxPayout: {
            type: Number,
            default: 100000.00,
            min: 1.00,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Compound index to ensure unique limits for sport+market combo
betLimitSchema.index({ sportType: 1, marketType: 1 }, { unique: true });

betLimitSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('BetLimit', betLimitSchema);
