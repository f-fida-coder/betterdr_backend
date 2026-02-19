const { User, Bet, Agent, Admin } = require('../models');

// Create User (Agent specific)
exports.createUser = async (req, res) => {
    try {
        const {
            username,
            phoneNumber,
            password,
            firstName,
            lastName,
            fullName,
            referredByUserId,
            balance,
            minBet,
            maxBet,
            creditLimit,
            balanceOwed,
            freeplayBalance,
            apps
        } = req.body;
        let assignedAgentId = req.user._id;

        // If Master Agent, allow assigning to a sub-agent
        if (req.user.role === 'master_agent' && req.body.agentId) {
            // Verify the target agent is created by this Master Agent
            const targetAgent = await Agent.findOne({ _id: req.body.agentId, createdBy: req.user._id });
            if (!targetAgent) {
                return res.status(403).json({ message: 'You can only create players for yourself or your direct sub-agents.' });
            }
            assignedAgentId = targetAgent._id;
        }

        // Validation
        if (!username || !phoneNumber || !password) {
            return res.status(400).json({ message: 'Username, phone number, and password are required' });
        }

        // Check if username/phone already exists in any account collection
        const existingInfo = await Promise.all([
            User.findOne({ $or: [{ username }, { phoneNumber }] }),
            Admin.findOne({ $or: [{ username }, { phoneNumber }] }),
            Agent.findOne({ $or: [{ username }, { phoneNumber }] })
        ]);
        if (existingInfo.some(doc => doc)) {
            return res.status(409).json({ message: 'Username or phone number already exists in the system' });
        }

        // Check weekly creation limit for this agent
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const recentUsersCount = await User.countDocuments({
            agentId: assignedAgentId,
            createdAt: { $gte: oneWeekAgo }
        });

        // Limit: 10 users per week
        const WEEKLY_LIMIT = 10;
        if (recentUsersCount >= WEEKLY_LIMIT) {
            return res.status(429).json({
                message: `Weekly limit reached. You can only create ${WEEKLY_LIMIT} new customers per week.`
            });
        }

        if (referredByUserId) {
            const referrer = await User.findOne({
                _id: referredByUserId,
                role: 'user',
                agentId: assignedAgentId
            }).select('_id');
            if (!referrer) {
                return res.status(400).json({ message: 'Referrer must be one of your own players' });
            }
        }

        // Create user assigned to this agent
        const newUser = new User({
            username: username.toUpperCase(),
            phoneNumber,
            password,
            rawPassword: password,
            firstName: (firstName || '').toUpperCase(),
            lastName: (lastName || '').toUpperCase(),
            fullName: (fullName || `${firstName || ''} ${lastName || ''}`.trim() || username).toUpperCase(),
            role: 'user',
            status: 'active',
            balance: balance != null ? balance : 1000,
            minBet: minBet != null ? minBet : (req.user.defaultMinBet || 25),
            maxBet: maxBet != null ? maxBet : (req.user.defaultMaxBet || 200),
            creditLimit: creditLimit != null ? creditLimit : (req.user.defaultCreditLimit || 1000),
            balanceOwed: balanceOwed != null ? balanceOwed : (req.user.defaultSettleLimit || 0),
            freeplayBalance: freeplayBalance != null ? freeplayBalance : 200,
            pendingBalance: 0,
            agentId: assignedAgentId,
            createdBy: req.user._id,
            createdByModel: 'Agent',
            referredByUserId: referredByUserId || null,
            referralBonusGranted: false,
            referralBonusAmount: 0,
            apps: apps || {}
        });

        await newUser.save();

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser._id,
                username: newUser.username,
                phoneNumber: newUser.phoneNumber,
                role: newUser.role,
                agentId: newUser.agentId
            }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Server error creating user' });
    }
};

// Get My Users
exports.getMyUsers = async (req, res) => {
    try {
        const agentId = req.user._id;

        const users = await User.find({ agentId }).populate('referredByUserId', 'username').select('username firstName lastName fullName phoneNumber balance pendingBalance balanceOwed freeplayBalance creditLimit minBet maxBet status createdAt totalWinnings rawPassword referredByUserId referralBonusGranted referralBonusAmount');
        // Calculate active status (>= 2 bets in last 7 days)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const activeUserIds = await Bet.aggregate([
            { $match: { userId: { $in: users.map(u => u._id) }, createdAt: { $gte: oneWeekAgo } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $match: { count: { $gte: 2 } } }
        ]);
        const activeSet = new Set(activeUserIds.map(a => String(a._id)));

        const formatted = users.map(user => {
            const balance = parseFloat(user.balance?.toString() || '0');
            const pendingBalance = parseFloat(user.pendingBalance?.toString() || '0');
            const availableBalance = Math.max(0, balance - pendingBalance);
            return {
                id: user._id,
                username: user.username,
                phoneNumber: user.phoneNumber,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName,
                minBet: user.minBet,
                maxBet: user.maxBet,
                creditLimit: parseFloat(user.creditLimit?.toString() || '0'),
                balanceOwed: parseFloat(user.balanceOwed?.toString() || '0'),
                freeplayBalance: parseFloat(user.freeplayBalance?.toString() || '0'),
                status: user.status,
                createdAt: user.createdAt,
                totalWinnings: user.totalWinnings,
                balance,
                pendingBalance,
                availableBalance,
                isActive: activeSet.has(String(user._id)),
                rawPassword: user.rawPassword,
                referredByUserId: user.referredByUserId?._id || null,
                referredByUsername: user.referredByUserId?.username || null,
                referralBonusGranted: Boolean(user.referralBonusGranted),
                referralBonusAmount: Number(user.referralBonusAmount || 0)
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Error fetching my users:', error);
        res.status(500).json({ message: 'Server error fetching users' });
    }
};

// Get Agent Stats
exports.getAgentStats = async (req, res) => {
    try {
        const agentId = req.user._id;

        // 1. Total Users
        const totalUsers = await User.countDocuments({ agentId });

        // 2. Get all users IDs for this agent
        const myUsers = await User.find({ agentId }).select('_id');
        const userIds = myUsers.map(u => u._id);

        if (userIds.length === 0) {
            return res.json({
                totalUsers: 0,
                totalBets: 0,
                totalWagered: 0,
                netProfit: 0
            });
        }

        // 3. Get Bets for these users
        const bets = await Bet.find({ userId: { $in: userIds } });

        let totalWagered = 0;
        let totalPayouts = 0;
        let winCount = 0;
        let betCount = bets.length;

        bets.forEach(bet => {
            totalWagered += parseFloat(bet.amount.toString());
            if (bet.status === 'won') {
                totalPayouts += parseFloat(bet.potentialPayout.toString());
                winCount += 1;
            }
        });

        const netProfit = totalWagered - totalPayouts; // House profit from these users
        const winRate = betCount > 0 ? (winCount / betCount) * 100 : 0;

        res.json({
            totalUsers,
            totalBets: betCount,
            totalWagered,
            netProfit,
            winRate: winRate.toFixed(2) // percent, rounded to 2 decimals
        });
    } catch (error) {
        console.error('Error fetching agent stats:', error);
        res.status(500).json({ message: 'Server error fetching stats' });
    }
};

// Agent updates customer balance owed (manual payment adjustments)
exports.updateUserBalanceOwed = async (req, res) => {
    try {
        const agentId = req.user._id;
        const { userId, balanceOwed, balance } = req.body;
        const nextValue = balance !== undefined ? balance : balanceOwed;

        if (!userId || nextValue === undefined) {
            return res.status(400).json({ message: 'User ID and balance are required' });
        }

        const user = await User.findById(userId);
        if (!user || user.role !== 'user') {
            return res.status(404).json({ message: 'Customer not found' });
        }

        if (req.user.role === 'agent' && String(user.agentId) !== String(agentId)) {
            return res.status(403).json({ message: 'Not authorized to update this customer' });
        }

        const balanceBefore = parseFloat(user.balance?.toString() || '0');
        const nextBalance = Math.max(0, Number(nextValue));

        user.balance = nextBalance;
        await user.save();

        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: user._id,
            agentId: req.user?._id || null,
            amount: Math.abs(nextBalance - balanceBefore),
            type: 'adjustment',
            status: 'completed',
            balanceBefore,
            balanceAfter: nextBalance,
            referenceType: 'Adjustment',
            reason: 'AGENT_BALANCE_ADJUSTMENT',
            description: 'Agent updated user balance'
        });

        const pendingBalance = parseFloat(user.pendingBalance?.toString() || '0');
        const availableBalance = Math.max(0, nextBalance - pendingBalance);
        res.json({
            message: 'Balance updated',
            user: {
                id: user._id,
                balance: nextBalance,
                pendingBalance,
                availableBalance
            }
        });
    } catch (error) {
        console.error('❌ Error updating balance owed in updateUserBalanceOwed:', {
            error: error.message,
            stack: error.stack,
            userId: req.body.userId,
            agentId: req.user?._id
        });
        res.status(500).json({ message: 'Server error updating balance owed', details: error.message });
    }
};
// Agent updates customer details
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            phoneNumber,
            firstName,
            lastName,
            fullName,
            password,
            minBet,
            maxBet,
            creditLimit,
            balanceOwed,
            apps
        } = req.body;
        const agentId = req.user._id;

        const user = await User.findById(id);
        if (!user || user.role !== 'user') {
            return res.status(404).json({ message: 'Customer not found' });
        }

        if (String(user.agentId) !== String(agentId)) {
            return res.status(403).json({ message: 'Not authorized to update this customer' });
        }

        if (phoneNumber && phoneNumber !== user.phoneNumber) {
            const existingPhone = await User.findOne({ phoneNumber, _id: { $ne: id } });
            if (existingPhone) {
                return res.status(409).json({ message: 'Phone number already exists' });
            }
            user.phoneNumber = phoneNumber;
        }

        if (password) {
            user.password = password;
            user.rawPassword = password;
        }
        if (firstName) user.firstName = firstName.toUpperCase();
        if (lastName) user.lastName = lastName.toUpperCase();
        if (fullName) {
            user.fullName = fullName.toUpperCase();
        } else if (firstName || lastName) {
            const fName = (firstName || user.firstName || '').toUpperCase();
            const lName = (lastName || user.lastName || '').toUpperCase();
            user.fullName = `${fName} ${lName}`.trim().toUpperCase();
        }

        if (minBet !== undefined) user.minBet = minBet;
        if (maxBet !== undefined) user.maxBet = maxBet;
        if (creditLimit !== undefined) user.creditLimit = creditLimit;
        if (balanceOwed !== undefined) user.balanceOwed = balanceOwed;
        if (freeplayBalance !== undefined) user.freeplayBalance = freeplayBalance;
        if (apps !== undefined) user.apps = { ...user.apps, ...apps };
        if (req.body.status) user.status = req.body.status;

        await user.save();

        res.json({ message: 'Customer updated successfully', user });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ message: 'Server error updating customer' });
    }
};

// --- Super Agent Functionality ---

// Get My Sub-Agents
exports.getMySubAgents = async (req, res) => {
    try {
        const masterAgentId = req.user._id;

        // Find agents created by this Master Agent
        const agents = await Agent.find({
            createdBy: masterAgentId,
            createdByModel: 'Agent'
        }).select('username phoneNumber balance balanceOwed role status createdAt permissions');

        res.json(agents);
    } catch (error) {
        console.error('Error fetching sub-agents:', error);
        res.status(500).json({ message: 'Server error fetching sub-agents' });
    }
};

// Create Sub-Agent
exports.createSubAgent = async (req, res) => {
    try {
        const { username, phoneNumber, password, fullName, defaultMinBet, defaultMaxBet, defaultCreditLimit, defaultSettleLimit, role } = req.body;
        const creator = req.user;

        // Only master_agent can create agents
        if (creator.role !== 'master_agent') {
            return res.status(403).json({ message: 'Only Master Agents can create agents' });
        }

        // Validation
        if (!username || !phoneNumber || !password) {
            return res.status(400).json({ message: 'Username, phone number, and password are required' });
        }

        // Check if username/phone exists in ANY collection
        const existingInfo = await Promise.all([
            User.findOne({ $or: [{ username }, { phoneNumber }] }),
            Admin.findOne({ $or: [{ username }, { phoneNumber }] }),
            Agent.findOne({ $or: [{ username }, { phoneNumber }] })
        ]);

        if (existingInfo.some(doc => doc)) {
            return res.status(409).json({ message: 'Username or Phone number already exists in the system' });
        }

        const agentRole = (role === 'master_agent') ? 'master_agent' : 'agent';

        // Create sub-agent
        const newAgent = new Agent({
            username: username.toUpperCase(),
            phoneNumber,
            password,
            fullName: (fullName || username).toUpperCase(),
            role: agentRole,
            status: 'active',
            balance: 0.00,
            agentBillingRate: creator.agentBillingRate || 0.00,
            agentBillingStatus: 'paid',
            defaultMinBet: defaultMinBet != null ? defaultMinBet : 25,
            defaultMaxBet: defaultMaxBet != null ? defaultMaxBet : 200,
            defaultCreditLimit: defaultCreditLimit != null ? defaultCreditLimit : 1000,
            defaultSettleLimit: defaultSettleLimit != null ? defaultSettleLimit : 0,
            createdBy: creator._id,
            createdByModel: 'Agent'
        });

        await newAgent.save();

        res.status(201).json({
            message: 'Sub-Agent created successfully',
            agent: {
                id: newAgent._id,
                username: newAgent.username,
                phoneNumber: newAgent.phoneNumber,
                fullName: newAgent.fullName,
                role: newAgent.role,
                status: newAgent.status,
                createdAt: newAgent.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating sub-agent:', error);
        res.status(500).json({ message: 'Server error creating sub-agent' });
    }
};
