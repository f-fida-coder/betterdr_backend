const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        items: {
            type: [String],
            default: [],
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

ruleSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('Rule', ruleSchema);
