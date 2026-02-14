const { User, Transaction } = require('../models');
const mongoose = require('mongoose');

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

module.exports = { getBalance, deposit };
