const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
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
        rawPassword: {
            type: String,
            default: '',
        },
        firstName: {
            type: String,
            default: null,
        },
        lastName: {
            type: String,
            default: null,
        },
        fullName: {
            type: String,
            default: null,
        },
        minBet: {
            type: Number,
            default: 1, // Default from platform settings usually
        },
        maxBet: {
            type: Number,
            default: 5000, // Default from platform settings usually
        },
        balance: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        creditLimit: {
            type: mongoose.Decimal128,
            default: 1000.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        balanceOwed: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        pendingBalance: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        totalWinnings: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        role: {
            type: String,
            default: 'user',
            immutable: true
        },
        status: {
            type: String,
            enum: ['active', 'disabled', 'read only', 'ghost', 'bot', 'sharp', 'suspended'], // Keeping suspended for compatibility if needed, but the UI will use the new ones
            default: 'active',
        },
        agentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agent', // Updated ref to Agent collection
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'createdByModel',
            default: null,
        },
        createdByModel: {
            type: String,
            required: false,
            enum: ['Admin', 'Agent', 'User'], // Allow User for self-registration if needed
            default: null
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        kycVerifiedAt: {
            type: Date,
            default: null,
        },
        accountStatus: {
            type: String,
            enum: ['active', 'suspended', 'closed'],
            default: 'active',
        },
        betCount: {
            type: Number,
            default: 0,
        },
        totalWagered: {
            type: mongoose.Decimal128,
            default: 0.00,
            get: (value) => value ? value.toString() : '0.00',
        },
        settings: {
            sports: { type: Boolean, default: true },
            casino: { type: Boolean, default: true },
            racebook: { type: Boolean, default: true },
            live: { type: Boolean, default: true },
            props: { type: Boolean, default: true },
            liveCasino: { type: Boolean, default: true }
        },
        apps: {
            venmo: { type: String, default: '' },
            cashapp: { type: String, default: '' },
            applePay: { type: String, default: '' },
            zelle: { type: String, default: '' },
            paypal: { type: String, default: '' },
            btc: { type: String, default: '' },
            other: { type: String, default: '' }
        },
        freeplayBalance: {
            type: mongoose.Decimal128,
            default: 200.00,
            get: (value) => value ? value.toString() : '0.00',
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual field for id (alias of _id) to maintain compatibility
userSchema.virtual('id').get(function () {
    return this._id.toString();
});

userSchema.virtual('availableCredit').get(function () {
    const limit = parseFloat(this.creditLimit ? this.creditLimit.toString() : '0');
    const owed = parseFloat(this.balanceOwed ? this.balanceOwed.toString() : '0');
    const available = limit - owed;
    return available < 0 ? 0 : available;
});

userSchema.virtual('availableBalance').get(function () {
    const balance = parseFloat(this.balance ? this.balance.toString() : '0');
    const pending = parseFloat(this.pendingBalance ? this.pendingBalance.toString() : '0');
    const available = balance - pending;
    return available < 0 ? 0 : available;
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Hash password before updating if it's modified
userSchema.pre('findByIdAndUpdate', async function (next) {
    if (this.getUpdate().$set && this.getUpdate().$set.password) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.getUpdate().$set.password = await bcrypt.hash(this.getUpdate().$set.password, salt);
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
