const Stripe = require('stripe');
const { User, Transaction } = require('../models');
const mongoose = require('mongoose');

const transactionsEnabled = () => String(process.env.MONGODB_TRANSACTIONS_ENABLED || 'false').toLowerCase() === 'true';
const withSession = (query, session) => (session ? query.session(session) : query);
const saveWithSession = (doc, session) => (session ? doc.save({ session }) : doc.save());
const createWithSession = (Model, docs, session) => (session ? Model.create(docs, { session }) : Model.create(docs));
const runWithOptionalTransaction = async (work) => {
    if (!transactionsEnabled()) {
        return work(null);
    }
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } catch (error) {
        const message = error?.message || '';
        if (message.includes('Transaction numbers are only allowed') || message.toLowerCase().includes('replica set')) {
            return work(null);
        }
        throw error;
    } finally {
        try { session.endSession(); } catch (e) { }
    }
};

// Initialize Stripe safely
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = (stripeKey && !stripeKey.includes('PLACEHOLDER')) ? Stripe(stripeKey) : null;

if (!stripe) {
    console.warn('⚠️ Stripe API key is missing or is a placeholder. Payments will be disabled.');
}

const createDepositIntent = async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ message: 'Payment service is currently unavailable. Please contact support.' });
        }
        const { amount } = req.body;
        const userId = req.user._id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Restrict 'user' role from self-service deposits
        if (req.user.role === 'user') {
            return res.status(403).json({ message: 'Deposits are disabled. Please contact your agent to add funds.' });
        }

        // Create a PaymentIntent with the order amount and currency
        // Amount in Stripe is in smallest currency unit (e.g., cents)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            metadata: {
                userId: userId.toString(),
                type: 'deposit'
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ message: 'Error creating payment intent', error: error.message });
    }
};

const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    if (!stripe) {
        return res.status(503).send('Stripe not initialized');
    }

    try {
        // req.rawBody must be available. 
        // We will ensure in server.js that rawBody is preserved for this route.
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        await handleSuccessfulDeposit(paymentIntent);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};

const handleSuccessfulDeposit = async (paymentIntent) => {
    try {
        const { userId, type } = paymentIntent.metadata;
        const amount = paymentIntent.amount / 100; // Convert back to main currency unit

        if (type === 'deposit' && userId) {
            await runWithOptionalTransaction(async (session) => {
                const user = await withSession(User.findById(userId), session);
                if (!user) {
                    console.error(`User not found for deposit: ${userId}`);
                    return;
                }

                // Update user balance
                const newBalance = parseFloat(user.balance.toString()) + parseFloat(amount);
                user.balance = newBalance;
                await saveWithSession(user, session);

                // Create Transaction record
                await createWithSession(Transaction, [{
                    userId,
                    amount,
                    type: 'deposit',
                    status: 'completed',
                    stripePaymentId: paymentIntent.id,
                    description: 'Stripe Deposit'
                }], session);

                console.log(`Deposit processed for user ${userId}: $${amount}`);
            });
        }
    } catch (error) {
        console.error('Error in handleSuccessfulDeposit:', error);
    }
};

module.exports = {
    createDepositIntent,
    handleWebhook
};
