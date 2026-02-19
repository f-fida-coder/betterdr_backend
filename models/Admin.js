const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^\+?[0-9]\d{1,14}$/, 'Invalid phone number format'],
            index: true,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            default: 'admin',
            immutable: true
        },
        isSuperAdmin: {
            type: Boolean,
            default: false,
        },
        unlimitedBalance: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ['active', 'suspended'],
            default: 'active',
        },
        viewOnly: { type: Boolean, default: false },
        dashboardLayout: { type: String, enum: ['tiles', 'sidebar'], default: 'tiles' },

        fullName: { type: String, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

adminSchema.virtual('id').get(function () {
    return this._id.toString();
});

// Hash password before saving
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
