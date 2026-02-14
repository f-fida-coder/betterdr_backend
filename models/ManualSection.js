const mongoose = require('mongoose');

const manualSectionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        order: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

manualSectionSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('ManualSection', manualSectionSchema);
