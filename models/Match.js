const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            unique: true,
            sparse: true,
            default: null,
        },
        homeTeam: {
            type: String,
            required: true,
        },
        awayTeam: {
            type: String,
            required: true,
        },
        startTime: {
            type: Date,
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['scheduled', 'live', 'finished', 'cancelled'],
            default: 'scheduled',
            index: true,
        },
        sport: {
            type: String,
            required: true,
        },
        odds: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        score: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        lastUpdated: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual field for id (alias of _id) to maintain compatibility
matchSchema.virtual('id').get(function() {
    return this._id.toString();
});

module.exports = mongoose.model('Match', matchSchema);
