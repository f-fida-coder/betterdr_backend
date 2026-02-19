const mongoose = require('mongoose');

const casinoGameSchema = new mongoose.Schema(
    {
        externalGameId: {
            type: String,
            default: null,
            index: true
        },
        provider: {
            type: String,
            required: true,
            default: 'internal',
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        category: {
            type: String,
            enum: ['lobby', 'table_games', 'slots', 'video_poker', 'specialty_games'],
            default: 'lobby',
            index: true
        },
        icon: {
            type: String,
            default: 'fa-solid fa-dice'
        },
        themeColor: {
            type: String,
            default: '#0f5db3'
        },
        imageUrl: {
            type: String,
            default: ''
        },
        launchUrl: {
            type: String,
            default: ''
        },
        minBet: {
            type: Number,
            default: 1,
            min: 0
        },
        maxBet: {
            type: Number,
            default: 100,
            min: 0
        },
        rtp: {
            type: Number,
            default: null,
            min: 0,
            max: 100
        },
        volatility: {
            type: String,
            enum: ['low', 'medium', 'high', null],
            default: null
        },
        tags: {
            type: [String],
            default: []
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        sortOrder: {
            type: Number,
            default: 100
        },
        status: {
            type: String,
            enum: ['active', 'maintenance', 'disabled'],
            default: 'active',
            index: true
        },
        supportsDemo: {
            type: Boolean,
            default: false
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

casinoGameSchema.virtual('id').get(function () {
    return this._id.toString();
});

casinoGameSchema.index({ category: 1, status: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('CasinoGame', casinoGameSchema);
