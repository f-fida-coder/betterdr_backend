const mongoose = require('mongoose');

const billingInvoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        amount: {
            type: mongoose.Decimal128,
            required: true,
            get: (value) => (value ? value.toString() : '0.00'),
        },
        status: {
            type: String,
            enum: ['paid', 'pending', 'overdue'],
            default: 'pending',
            index: true,
        },
        dueDate: {
            type: Date,
            default: null,
        },
        paidAt: {
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

billingInvoiceSchema.virtual('id').get(function () {
    return this._id.toString();
});

module.exports = mongoose.model('BillingInvoice', billingInvoiceSchema);
