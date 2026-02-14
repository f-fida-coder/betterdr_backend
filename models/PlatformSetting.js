const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema(
    {
        platformName: {
            type: String,
            default: 'Sports Betting Platform',
        },
        dailyBetLimit: {
            type: Number,
            default: 10000,
        },
        weeklyBetLimit: {
            type: Number,
            default: 50000,
        },
        maxOdds: {
            type: Number,
            default: 100,
        },
        minBet: {
            type: Number,
            default: 1,
        },
        maxBet: {
            type: Number,
            default: 5000,
        },
        maintenanceMode: {
            type: Boolean,
            default: false,
        },
        smsNotifications: {
            type: Boolean,
            default: true,
        },
        twoFactor: {
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

platformSettingSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
