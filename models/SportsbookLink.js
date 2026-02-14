const mongoose = require('mongoose');

const sportsbookLinkSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        url: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
        lastSync: {
            type: Date,
            default: null,
        },
        notes: {
            type: String,
            default: null,
        },
        createdBy: {
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

sportsbookLinkSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('SportsbookLink', sportsbookLinkSchema);
