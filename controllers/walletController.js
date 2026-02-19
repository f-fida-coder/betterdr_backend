const { User, Transaction } = require('../models');
const mongoose = require('mongoose');

const parseAmount = (value) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) return 0;
    return Number(amount.toFixed(2));
};

const getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            const balance = parseFloat(user.balance?.toString() || '0');
            const pendingBalance = parseFloat(user.pendingBalance?.toString() || '0');
            const availableBalance = Math.max(0, balance - pendingBalance);
            res.json({
                balance,
                pendingBalance,
                availableBalance,
                totalWinnings: user.totalWinnings,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getTransactions = async (req, res) => {
    try {
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const type = req.query.type ? String(req.query.type).toLowerCase() : '';
        const status = req.query.status ? String(req.query.status).toLowerCase() : '';

        const query = { userId: req.user._id };
        if (type) query.type = type;
        if (status) query.status = status;

        const transactions = await Transaction.find(query).sort({ createdAt: -1 }).limit(limit);
        const formatted = transactions.map((tx) => ({
            id: tx._id,
            amount: parseFloat(tx.amount?.toString() || '0'),
            type: tx.type,
            status: tx.status,
            description: tx.description,
            reason: tx.reason,
            balanceBefore: tx.balanceBefore != null ? parseFloat(tx.balanceBefore.toString()) : null,
            balanceAfter: tx.balanceAfter != null ? parseFloat(tx.balanceAfter.toString()) : null,
            createdAt: tx.createdAt
        }));

        res.json({ transactions: formatted });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const requestDeposit = async (req, res) => {
    try {
        const amount = parseAmount(req.body.amount);
        const method = String(req.body.method || 'manual').toLowerCase().trim();

        if (amount < 10 || amount > 100000) {
            return res.status(400).json({ message: 'Deposit amount must be between $10 and $100,000' });
        }

        const transaction = await Transaction.create({
            userId: req.user._id,
            agentId: req.user.agentId || null,
            amount,
            type: 'deposit',
            status: 'pending',
            reason: 'USER_DEPOSIT_REQUEST',
            referenceType: 'Adjustment',
            description: `Deposit request via ${method}`
        });

        res.status(201).json({
            message: 'Deposit request submitted successfully. Your agent/admin will review it.',
            transactionId: transaction._id
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const requestWithdrawal = async (req, res) => {
    try {
        const amount = parseAmount(req.body.amount);
        const method = String(req.body.method || 'manual').toLowerCase().trim();
        const user = await User.findById(req.user._id);

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (amount < 20 || amount > 100000) {
            return res.status(400).json({ message: 'Withdrawal amount must be between $20 and $100,000' });
        }

        const balance = parseFloat(user.balance?.toString() || '0');
        if (balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance for withdrawal request' });
        }

        const transaction = await Transaction.create({
            userId: req.user._id,
            agentId: req.user.agentId || null,
            amount,
            type: 'withdrawal',
            status: 'pending',
            reason: 'USER_WITHDRAWAL_REQUEST',
            referenceType: 'Adjustment',
            description: `Withdrawal request via ${method}`
        });

        res.status(201).json({
            message: 'Withdrawal request submitted successfully. Processing is pending approval.',
            transactionId: transaction._id
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// For testing purposes - manual deposit
const deposit = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user._id;

        return res.status(403).json({ message: 'Deposits are disabled. Customers use credit only.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

module.exports = {
    getBalance,
    getTransactions,
    requestDeposit,
    requestWithdrawal,
    deposit
};
