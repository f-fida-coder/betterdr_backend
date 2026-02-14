const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        amount: {
            type: mongoose.Decimal128,
            required: true,
            get: (value) => (value ? value.toString() : '0.00'),
        },
        dueDate: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ['pending', 'overdue', 'collected', 'cancelled'],
            default: 'pending',
            index: true,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        lastAttemptAt: {
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

collectionSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('Collection', collectionSchema);
