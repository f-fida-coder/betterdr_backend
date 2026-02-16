const mongoose = require('mongoose');

const ipLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        ip: {
            type: String,
            required: true,
            index: true,
        },
        userAgent: {
            type: String,
            default: null,
        },
        country: {
            type: String,
            default: 'Unknown',
        },
        city: {
            type: String,
            default: 'Unknown',
        },
        lastActive: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ['active', 'blocked', 'whitelisted'],
            default: 'active',
            index: true,
        },
        blockedAt: {
            type: Date,
            default: null,
        },
        blockedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        blockReason: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

ipLogSchema.index({ userId: 1, ip: 1 }, { unique: true });

ipLogSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('IpLog', ipLogSchema);
