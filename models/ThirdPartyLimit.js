const mongoose = require('mongoose');

const thirdPartyLimitSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        dailyLimit: {
            type: mongoose.Decimal128,
            default: 0.0,
            get: (value) => value ? value.toString() : '0.00',
        },
        monthlyLimit: {
            type: mongoose.Decimal128,
            default: 0.0,
            get: (value) => value ? value.toString() : '0.00',
        },
        used: {
            type: mongoose.Decimal128,
            default: 0.0,
            get: (value) => value ? value.toString() : '0.00',
        },
        status: {
            type: String,
            enum: ['active', 'warning', 'paused'],
            default: 'active',
        },
        lastSync: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

thirdPartyLimitSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('ThirdPartyLimit', thirdPartyLimitSchema);
