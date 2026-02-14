const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        userLabel: {
            type: String,
            default: 'Anonymous',
        },
        message: {
            type: String,
            required: true,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: 5,
        },
        status: {
            type: String,
            enum: ['new', 'reviewed'],
            default: 'new',
            index: true,
        },
        adminReply: {
            type: String,
            default: null,
        },
        repliedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

feedbackSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('Feedback', feedbackSchema);
