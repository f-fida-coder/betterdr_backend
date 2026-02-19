const mongoose = require('mongoose');

const betModeRuleSchema = new mongoose.Schema(
    {
        mode: {
            type: String,
            required: true,
            enum: ['straight', 'parlay', 'teaser', 'if_bet', 'reverse'],
            unique: true,
            index: true
        },
        minLegs: {
            type: Number,
            required: true,
            min: 1
        },
        maxLegs: {
            type: Number,
            required: true,
            min: 1
        },
        teaserPointOptions: {
            type: [Number],
            default: []
        },
        payoutProfile: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

betModeRuleSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('BetModeRule', betModeRuleSchema);
