const {
    User,
    Admin,
    Agent,
    Bet,
    Transaction,
    Message,
    Match,
    ThirdPartyLimit,
    IpLog,
    Collection,
    DeletedWager,
    SportsbookLink,
    BillingInvoice,
    PlatformSetting,
    Rule,
    Feedback,
    Faq,
    ManualSection
} = require('../models');
const bcrypt = require('bcrypt');
const { buildAuthPayload } = require('./authController');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const buildDayLabels = (startDate) => {
    const labels = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateLabel = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        labels.push(`${dayLabel} (${dateLabel})`);
    }
    return labels;
};

const parseAmount = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value.toString());
    return Number.isNaN(parsed) ? 0 : parsed;
};

const getSignedAmount = (transaction) => {
    const amount = parseAmount(transaction.amount);
    switch (transaction.type) {
        case 'deposit':
            return amount;
        case 'withdrawal':
            return -amount;
        case 'bet_placed':
            return -amount;
        case 'bet_won':
            return amount;
        case 'bet_refund':
            return amount;
        default:
            return 0;
    }
};

const getStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getStartDateFromPeriod = (period) => {
    const now = new Date();
    if (!period || period === 'all') return null;
    if (period === 'today') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (period === 'this-week') {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        return start;
    }
    if (period === 'this-month') {
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        return start;
    }
    if (period === '30d') {
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        return start;
    }
    if (period === '7d') {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        return start;
    }
    return null;
};

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
};

// Get all users
exports.getUsers = async (req, res) => {
    try {
        const query = { role: 'user' };
        if (req.user.role === 'agent') {
            query.agentId = req.user._id;
        }

        const users = await User.find(query)
            .select('-password')
            .populate('agentId', 'username')
            .populate('createdBy', 'username role') // Populate polymorphic creator
            .select('username firstName lastName fullName phoneNumber balance pendingBalance balanceOwed creditLimit minBet maxBet role status settings createdAt agentId createdBy createdByModel rawPassword');
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
            const balanceOwed = parseFloat(user.balanceOwed?.toString() || '0');
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
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                agentId: user.agentId,
                balance,
                pendingBalance,
                balanceOwed,
                availableBalance,
                isActive: activeSet.has(String(user._id)),
                createdBy: user.createdBy ? { username: user.createdBy.username, role: user.createdBy.role } : null,
                createdByModel: user.createdByModel,
                settings: user.settings,
                rawPassword: user.rawPassword
            };
        });
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all agents
exports.getAgents = async (req, res) => {
    try {
        const agents = await Agent.find()
            .populate('createdBy', 'username')
            .select('username phoneNumber balance balanceOwed role status createdAt createdBy agentBillingRate agentBillingStatus viewOnly');

        const activeSince = new Date(Date.now() - 7 * MS_PER_DAY);
        const activeUserIds = await Bet.aggregate([
            { $match: { createdAt: { $gte: activeSince } } },
            { $group: { _id: '$userId', betCount: { $sum: 1 } } },
            { $match: { betCount: { $gte: 2 } } }
        ]);
        const activeUserSet = new Set(activeUserIds.map(row => String(row._id)));

        const agentsWithCount = await Promise.all(
            agents.map(async (agent) => {
                const userCount = await User.countDocuments({ agentId: agent._id });
                const agentUsers = await User.find({ agentId: agent._id, status: 'active' }).select('_id');
                const activeCustomerCount = agentUsers.filter(u => activeUserSet.has(String(u._id))).length;

                let subAgentCount = 0;
                let totalUsersInHierarchy = 0;

                if (agent.role === 'super_agent') {
                    const subAgents = await Agent.find({ createdBy: agent._id, createdByModel: 'Agent' }).select('_id');
                    subAgentCount = subAgents.length;
                    const subAgentIds = subAgents.map(sa => sa._id);
                    totalUsersInHierarchy = await User.countDocuments({ agentId: { $in: subAgentIds } });
                }

                const obj = agent.toObject();
                if (obj.balance != null) {
                    try {
                        obj.balance = parseFloat(agent.balance.toString());
                    } catch (e) {
                        obj.balance = Number(obj.balance) || 0;
                    }
                } else {
                    obj.balance = 0;
                }

                const billingRate = parseFloat(agent.agentBillingRate?.toString() || '0');
                const weeklyCharge = billingRate * (activeCustomerCount || 0);
                return {
                    id: agent._id,
                    ...obj,
                    userCount,
                    subAgentCount,
                    totalUsersInHierarchy,
                    activeCustomerCount,
                    agentBillingRate: billingRate,
                    agentBillingStatus: agent.agentBillingStatus,
                    viewOnly: agent.viewOnly || agent.agentBillingStatus === 'unpaid',
                    weeklyCharge
                };
            })
        );

        res.json(agentsWithCount);
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ message: 'Server error fetching agents' });
    }
};

// Create new agent
exports.createAgent = async (req, res) => {
    try {
        const { username, phoneNumber, password, fullName } = req.body;
        const creatorAdmin = req.user; // From auth middleware

        // Validation
        if (!username || !phoneNumber || !password) {
            return res.status(400).json({ message: 'Username, phone number, and password are required' });
        }

        // Check if username already exists in ANY collection
        const existingInfo = await Promise.all([
            User.findOne({ $or: [{ username }, { phoneNumber }] }),
            Admin.findOne({ $or: [{ username }, { phoneNumber }] }),
            Agent.findOne({ $or: [{ username }, { phoneNumber }] })
        ]);

        if (existingInfo.some(doc => doc)) {
            return res.status(409).json({ message: 'Username or Phone number already exists in the system' });
        }

        // Create agent - strictly super_agent
        const newAgent = new Agent({
            username,
            phoneNumber,
            password,
            fullName: fullName || username,
            role: 'super_agent',
            status: 'active',
            balance: 0.00,
            agentBillingRate: 0.00,
            agentBillingStatus: 'paid',
            viewOnly: false,
            createdBy: creatorAdmin._id,
            createdByModel: 'Admin'
        });

        await newAgent.save();

        res.status(201).json({ message: 'Agent created successfully' });
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ message: 'Server error creating agent: ' + error.message });
    }
};

// Update Agent
exports.updateAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const { phoneNumber, password, agentBillingRate, agentBillingStatus, balance } = req.body;

        const agent = await Agent.findById(id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        // Only update fields if provided
        if (phoneNumber) agent.phoneNumber = phoneNumber;
        if (password) agent.password = password; // Pre-save hook will hash this
        if (agentBillingRate !== undefined) agent.agentBillingRate = agentBillingRate;
        let balanceBefore = null;
        if (balance !== undefined) {
            balanceBefore = parseFloat(agent.balance?.toString() || '0');
            agent.balance = Math.max(0, Number(balance));
        }
        if (agentBillingStatus) {
            agent.agentBillingStatus = agentBillingStatus;
            agent.viewOnly = agentBillingStatus === 'unpaid';
            if (agentBillingStatus === 'paid') {
                agent.agentBillingLastPaidAt = new Date();
            }
        }

        await agent.save();

        if (balance !== undefined) {
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                agentId: agent._id,
                adminId: req.user?._id || null,
                amount: Math.abs(agent.balance - (balanceBefore || 0)),
                type: 'adjustment',
                status: 'completed',
                balanceBefore,
                balanceAfter: agent.balance,
                referenceType: 'Adjustment',
                reason: 'ADMIN_AGENT_BALANCE_ADJUSTMENT',
                description: 'Admin updated agent balance'
            });
        }

        res.json({ message: 'Agent updated successfully', agent });
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({ message: 'Server error updating agent' });
    }
};

// Create new user (by admin or agent)
exports.createUser = async (req, res) => {
    try {
        const {
            username,
            phoneNumber,
            password,
            firstName,
            lastName,
            fullName,
            agentId,
            balance,
            minBet,
            maxBet,
            creditLimit,
            balanceOwed,
            apps
        } = req.body;
        const creator = req.user; // From auth middleware

        // Validation
        if (!username || !phoneNumber || !password) {
            return res.status(400).json({ message: 'Username, phone number, and password are required' });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists' });
        }

        // Check if phone number already exists
        const existingPhone = await User.findOne({ phoneNumber });
        if (existingPhone) {
            return res.status(409).json({ message: 'Phone number already exists' });
        }

        // Validate Agent if provided
        // Validate Agent if provided (or force it if creator is agent)
        let assignedAgentId = null;

        if (creator.role === 'agent') {
            assignedAgentId = creator._id;
        } else if (agentId) {
            const agentObj = await Agent.findOne({ _id: agentId, role: 'agent' });
            if (agentObj) {
                assignedAgentId = agentId;
            } else {
                return res.status(400).json({ message: 'Invalid Agent ID or cannot assign users to a Super Agent' });
            }
        }

        // Create user
        const newUser = new User({
            username,
            phoneNumber,
            password,
            rawPassword: password,
            firstName,
            lastName,
            fullName: fullName || `${firstName || ''} ${lastName || ''}`.trim() || username,
            role: 'user',
            status: 'active',
            balance: balance != null ? balance : 1000,
            minBet: minBet != null ? minBet : 1,
            maxBet: maxBet != null ? maxBet : 5000,
            creditLimit: creditLimit != null ? creditLimit : 1000,
            balanceOwed: balanceOwed != null ? balanceOwed : 0,
            pendingBalance: 0,
            agentId: assignedAgentId,
            apps: apps || {}
        });

        await newUser.save();

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser._id,
                username: newUser.username,
                phoneNumber: newUser.phoneNumber,
                fullName: newUser.fullName,
                role: newUser.role,
                status: newUser.status,
                balance: newUser.balance,
                agentId: newUser.agentId,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating user:', error.message, error);
        res.status(500).json({ message: 'Server error creating user: ' + error.message });
    }
};

exports.getNextUsername = async (req, res) => {
    try {
        const { prefix } = req.params;
        if (!prefix) return res.status(400).json({ message: 'Prefix is required' });

        // Find all users with this prefix followed by numbers
        const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
        const users = await User.find({ username: regex }).select('username');

        let maxNum = 100; // Starting from 101 as per user example FIDA101
        users.forEach(u => {
            const match = u.username.match(regex);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        });

        const nextUsername = `${prefix.toUpperCase()}${maxNum + 1}`;
        res.json({ nextUsername });
    } catch (error) {
        console.error('Error getting next username:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// Update User
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            phoneNumber,
            password,
            firstName,
            lastName,
            fullName,
            status,
            balance,
            minBet,
            maxBet,
            creditLimit,
            balanceOwed,
            settings,
            apps
        } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Only update fields if provided
        if (phoneNumber && phoneNumber !== user.phoneNumber) {
            // Check if phone number already exists
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
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (fullName) {
            user.fullName = fullName;
        } else if (firstName || lastName) {
            const fName = firstName || user.firstName || '';
            const lName = lastName || user.lastName || '';
            user.fullName = `${fName} ${lName}`.trim();
        }

        if (status) user.status = status;
        if (minBet !== undefined) user.minBet = minBet;
        if (maxBet !== undefined) user.maxBet = maxBet;
        if (creditLimit !== undefined) user.creditLimit = creditLimit;
        if (balanceOwed !== undefined) user.balanceOwed = balanceOwed;
        if (settings !== undefined) user.settings = { ...user.settings, ...settings };
        if (apps !== undefined) user.apps = { ...user.apps, ...apps };

        let balanceBefore = null;
        if (balance !== undefined) {
            balanceBefore = parseFloat(user.balance?.toString() || '0');
            user.balance = Math.max(0, Number(balance));
        }

        await user.save();

        if (balance !== undefined) {
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                userId: user._id,
                adminId: req.user?._id || null,
                amount: Math.abs(user.balance - (balanceBefore || 0)),
                type: 'adjustment',
                status: 'completed',
                balanceBefore,
                balanceAfter: user.balance,
                referenceType: 'Adjustment',
                reason: 'ADMIN_USER_BALANCE_ADJUSTMENT',
                description: 'Admin updated user balance'
            });
        }

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Server error updating user' });
    }
};

// Suspend user
exports.suspendUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Agent can only suspend their own users
        if (req.user.role === 'agent' && String(user.agentId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to suspend this user' });
        }

        user.status = 'suspended';
        await user.save();

        res.json({ message: `User ${user.username} suspended` });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Unsuspend user
exports.unsuspendUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Agent can only unsuspend their own users
        if (req.user.role === 'agent' && String(user.agentId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to unsuspend this user' });
        }

        user.status = 'active';
        await user.save();

        res.json({ message: `User ${user.username} unsuspended` });
    } catch (error) {
        console.error('Error unsuspending user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update user credit limit or balance owed
exports.updateUserCredit = async (req, res) => {
    try {
        const { id } = req.params;
        const { balance } = req.body;

        const user = await User.findById(id);
        if (!user || user.role !== 'user') {
            return res.status(404).json({ message: 'User not found' });
        }

        let agent = null;
        // Agent Check
        if (req.user.role === 'agent') {
            if (String(user.agentId) !== String(req.user._id)) {
                return res.status(403).json({ message: 'Not authorized to update this user' });
            }
            agent = await Agent.findById(req.user._id);
            if (!agent) {
                return res.status(404).json({ message: 'Agent account not found' });
            }
        }

        if (balance === undefined || Number.isNaN(Number(balance))) {
            return res.status(400).json({ message: 'Balance is required' });
        }

        const nextBalance = Math.max(0, Number(balance));
        const balanceBefore = parseFloat(user.balance?.toString() || '0');
        const diff = nextBalance - balanceBefore;

        // If agent is performing the update, enforce balance check
        if (agent) {
            const agentBalance = parseFloat(agent.balance?.toString() || '0');
            if (diff > 0 && agentBalance < diff) {
                return res.status(400).json({ message: `Insufficient balance. You need ${diff.toFixed(2)} but only have ${agentBalance.toFixed(2)}` });
            }

            // Update agent balance (deduct if increasing user credit, refund if decreasing)
            agent.balance = agentBalance - diff;
            await agent.save();
        }

        user.balance = nextBalance;
        await user.save();

        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: user._id,
            adminId: req.user?._id || null,
            amount: Math.abs(diff),
            type: 'adjustment',
            status: 'completed',
            balanceBefore,
            balanceAfter: nextBalance,
            referenceType: 'Adjustment',
            reason: 'ADMIN_BALANCE_ADJUSTMENT',
            description: agent ? `Agent ${agent.username} updated user balance` : 'Admin updated user balance'
        });

        const pendingBalance = parseFloat(user.pendingBalance?.toString() || '0');
        const availableBalance = Math.max(0, nextBalance - pendingBalance);

        res.json({
            message: 'User balance updated',
            user: {
                id: user._id,
                balance: nextBalance,
                pendingBalance,
                availableBalance
            },
            agentBalance: agent ? parseFloat(agent.balance.toString()) : undefined
        });
    } catch (error) {
        console.error('❌ Error updating user balance in updateUserCredit:', {
            error: error.message,
            stack: error.stack,
            userId: req.params.id,
            body: req.body,
            adminId: req.user?._id
        });
        res.status(500).json({ message: 'Server error updating user balance', details: error.message });
    }
};

// Reset customer password
exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const user = await User.findById(id);
        if (!user || user.role !== 'user') {
            return res.status(404).json({ message: 'User not found' });
        }

        // Agent can only reset password for their own users
        if (req.user.role === 'agent' && String(user.agentId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to reset password for this user' });
        }

        user.password = newPassword;
        await user.save(); // Model's pre-save hook will handle hashing

        res.json({ message: `Password for user ${user.username} has been reset successfully` });
    } catch (error) {
        console.error('Error resetting user password:', error);
        res.status(500).json({ message: 'Server error resetting user password' });
    }
};

// Reset agent password (Admin only)
exports.resetAgentPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const agent = await Agent.findById(id);
        if (!agent || agent.role !== 'agent') {
            return res.status(404).json({ message: 'Agent not found' });
        }

        agent.password = newPassword;
        await agent.save(); // Agent model has pre-save hook too

        res.json({ message: `Password for agent ${agent.username} has been reset successfully` });
    } catch (error) {
        console.error('Error resetting agent password:', error);
        res.status(500).json({ message: 'Server error resetting agent password' });
    }
};

// Get Weekly Stats
exports.getStats = async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Total Bets Placed in last 7 days
        const betQuery = {
            createdAt: { $gte: oneWeekAgo },
            status: { $in: ['won', 'lost'] }
        };

        // If agent, filter bets by users belonging to this agent
        if (req.user.role === 'agent') {
            const myUsers = await User.find({ agentId: req.user._id }).select('_id');
            const myUserIds = myUsers.map(u => u._id);
            betQuery.userId = { $in: myUserIds };
        }

        const bets = await Bet.find(betQuery);

        let totalWagered = 0;
        let totalPayouts = 0;

        bets.forEach(bet => {
            totalWagered += parseFloat(bet.amount.toString());
            if (bet.status === 'won') {
                totalPayouts += parseFloat(bet.potentialPayout.toString());
            }
        });

        const houseProfit = totalWagered - totalPayouts;

        res.json({
            totalWagered,
            totalPayouts,
            houseProfit
        });

    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ message: 'Server error with stats' });
    }
};

// Get System Monitor Stats (Live Dashboard)
exports.getSystemStats = async (req, res) => {
    try {
        const { Match } = require('../models');

        // Parallel fetch for counts
        const queryUsers = { role: 'user' };
        if (req.user.role === 'agent') {
            queryUsers.agentId = req.user._id;
        }

        // For bets, we need user IDs first if agent
        let betQuery = {};
        if (req.user.role === 'agent') {
            const myUsers = await User.find({ agentId: req.user._id }).select('_id');
            betQuery.userId = { $in: myUsers.map(u => u._id) };
        }

        const [userCount, betCount, matchCount, liveMatches] = await Promise.all([
            User.countDocuments(queryUsers),
            Bet.countDocuments(betQuery),
            Match.countDocuments(),
            Match.find({
                $or: [
                    { status: 'live' },
                    { 'score.score_home': { $gt: 0 } },
                    { 'score.score_away': { $gt: 0 } }
                ]
            }).sort({ lastUpdated: -1 }).limit(20)
        ]);

        res.json({
            counts: {
                users: userCount,
                bets: betCount,
                matches: matchCount
            },
            liveMatches: liveMatches,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ message: 'Server error with system stats' });
    }
};

// Admin Header Summary
// Admin Header Summary
exports.getAdminHeaderSummary = async (req, res) => {
    try {
        const startOfToday = getStartOfDay(new Date());
        const startOfWeek = getStartOfWeek(new Date());

        // For House Profit:
        // User Bet (-Amt) -> House (+Amt)
        // User Win (+Amt) -> House (-Amt)
        // So House Profit = -1 * (Sum of User Transaction Amounts for bets)
        const signedAmountExpr = {
            $cond: [
                { $in: ['$type', ['withdrawal', 'bet_placed']] },
                { $multiply: [-1, { $toDouble: '$amount' }] },
                { $toDouble: '$amount' }
            ]
        };

        // Calculate Aggregation Pipelines conditionally
        let matchUser = {};
        let matchAgent = {};
        if (req.user.role === 'agent') {
            // Agent sees only their users sum, and their OWN balance owed as agent
            // Ideally header summary for agent:
            // Total Balance (of their users)
            // Total Outstanding (users owing them)
            // Today Net / Week Net (from their users)

            // Get Agent's Users
            const myUsers = await User.find({ agentId: req.user._id }).select('_id');
            const myUserIds = myUsers.map(u => u._id);
            matchUser = { _id: { $in: myUserIds } };
            matchAgent = { _id: req.user._id }; // Agent's own debt to platform? Or maybe 0 for simplicity in this view
        }

        const [
            balanceAgg,
            userOutstandingAgg,
            agentOutstandingAgg, // Only relevant for Admin
            activeAccounts,
            todayAgg,
            weekAgg
        ] = await Promise.all([
            User.aggregate([
                { $match: matchUser }, // Filter
                { $group: { _id: null, totalBalance: { $sum: { $toDouble: '$balance' } } } }
            ]),
            User.aggregate([
                { $match: matchUser },
                { $group: { _id: null, total: { $sum: { $toDouble: '$balanceOwed' } } } }
            ]),
            req.user.role === 'admin' ? Agent.aggregate([
                { $group: { _id: null, total: { $sum: { $toDouble: '$balanceOwed' } } } }
            ]) : Promise.resolve([]),
            User.countDocuments({ ...matchUser, status: 'active' }),

            Transaction.aggregate([
                {
                    $match: {
                        status: 'completed',
                        type: { $in: ['bet_placed', 'bet_won'] },
                        createdAt: { $gte: startOfToday },
                        // If agent, filter matches/transactions by user IDs? 
                        // Transaction has userId.
                    }
                },
                // We need to filter by userId in Transaction. If filtering is needed, we need a $lookup or $in.
                // Since we resolved myUserIds above if agent:
                ...(req.user.role === 'agent' ? [
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
                    { $match: { 'user.agentId': req.user._id } }
                ] : []),
                { $group: { _id: null, net: { $sum: signedAmountExpr } } }
            ]),
            Transaction.aggregate([
                {
                    $match: {
                        status: 'completed',
                        type: { $in: ['bet_placed', 'bet_won'] },
                        createdAt: { $gte: startOfWeek }
                    }
                },
                ...(req.user.role === 'agent' ? [
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
                    { $match: { 'user.agentId': req.user._id } }
                ] : []),
                { $group: { _id: null, net: { $sum: signedAmountExpr } } }
            ])
        ]);

        const totalBalance = balanceAgg[0]?.totalBalance || 0;
        const totalOutstanding = (userOutstandingAgg[0]?.total || 0) + (agentOutstandingAgg[0]?.total || 0);

        // Invert for House Profit: If User Net is -100 (Loss), House Profit is +100
        const todayNet = (todayAgg[0]?.net || 0) * -1;
        const weekNet = (weekAgg[0]?.net || 0) * -1;

        res.json({
            totalBalance,
            totalOutstanding,
            todayNet,
            weekNet,
            activeAccounts
        });
    } catch (error) {
        console.error('Error getting admin header summary:', error);
        res.status(500).json({ message: 'Server error getting header summary' });
    }
};

// Manual Odds Refresh
exports.refreshOdds = async (req, res) => {
    try {
        const oddsService = require('../services/oddsService');
        const results = await oddsService.updateMatches({ source: 'admin', forceFetch: true });
        res.json({ message: 'Odds refreshed successfully', results });
    } catch (error) {
        console.error('Error refreshing odds:', error);
        res.status(500).json({ message: 'Server error refreshing odds' });
    }
};

// Manual Odds Fetch (Admin)
exports.fetchOddsManual = async (req, res) => {
    try {
        const oddsService = require('../services/oddsService');
        console.log('🧪 Manual odds fetch triggered by admin');
        const results = await oddsService.updateMatches({ source: 'admin', forceFetch: true });
        res.json({ message: 'Manual odds fetch completed', results });
    } catch (error) {
        console.error('Error in manual odds fetch:', error);
        res.status(500).json({ message: 'Server error manual odds fetch' });
    }
};

// Weekly Figures Report
exports.getWeeklyFigures = async (req, res) => {
    try {
        const period = req.query.period || 'this-week';
        const now = new Date();
        let start = getStartOfWeek(now);
        if (period === 'last-week') {
            start = new Date(start.getTime() - 7 * MS_PER_DAY);
        } else if (period === 'previous') {
            start = new Date(start.getTime() - 14 * MS_PER_DAY);
        }
        const end = new Date(start.getTime() + 7 * MS_PER_DAY);

        const query = { role: 'user' };
        if (req.user.role === 'agent') {
            query.agentId = req.user._id;
        }

        const [users, agentsManagersCount] = await Promise.all([
            User.find(query).select('username phoneNumber fullName balance pendingBalance status createdAt'),
            User.countDocuments({ role: { $in: ['agent', 'admin'] } })
        ]);

        const userIds = users.map(u => u._id);
        const transactions = await Transaction.find({
            userId: { $in: userIds },
            status: 'completed',
            createdAt: { $gte: start, $lt: end }
        }).select('userId amount type createdAt status');

        const summaryDaily = Array(7).fill(0);
        const userMap = new Map();

        users.forEach(user => {
            userMap.set(user._id.toString(), {
                user,
                daily: Array(7).fill(0)
            });
        });

        transactions.forEach(tx => {
            const dayIndex = Math.floor((new Date(tx.createdAt).getTime() - start.getTime()) / MS_PER_DAY);
            if (dayIndex < 0 || dayIndex > 6) return;
            const signed = getSignedAmount(tx);
            summaryDaily[dayIndex] += signed;
            const entry = userMap.get(tx.userId.toString());
            if (entry) {
                entry.daily[dayIndex] += signed;
            }
        });

        const dayLabels = buildDayLabels(start);
        const customers = Array.from(userMap.values()).map(({ user, daily }) => {
            const weekTotal = daily.reduce((sum, v) => sum + v, 0);
            const balance = parseAmount(user.balance);
            const pending = parseAmount(user.pendingBalance);
            const carry = balance - weekTotal;

            return {
                id: user._id,
                username: user.username,
                name: user.fullName || user.username,
                phoneNumber: user.phoneNumber,
                daily,
                week: weekTotal,
                carry,
                balance,
                pending,
                status: user.status
            };
        });

        const totalPlayers = users.length;
        const deadAccounts = users.filter(u => u.status === 'suspended').length;
        const weekTotal = summaryDaily.reduce((sum, v) => sum + v, 0);
        const balanceTotal = users.reduce((sum, u) => sum + parseAmount(u.balance), 0);
        const pendingTotal = users.reduce((sum, u) => sum + parseAmount(u.pendingBalance), 0);

        res.json({
            period,
            startDate: start,
            endDate: end,
            summary: {
                totalPlayers,
                deadAccounts,
                agentsManagers: agentsManagersCount,
                days: dayLabels.map((label, index) => ({
                    day: label,
                    amount: summaryDaily[index]
                })),
                weekTotal,
                balanceTotal,
                pendingTotal
            },
            customers
        });
    } catch (error) {
        console.error('Error getting weekly figures:', error);
        res.status(500).json({ message: 'Server error fetching weekly figures' });
    }
};

// Pending Transactions
exports.getPendingTransactions = async (req, res) => {
    try {
        let query = { status: 'pending' };

        if (req.user.role === 'agent') {
            const myUsers = await User.find({ agentId: req.user._id }).select('_id');
            query.userId = { $in: myUsers.map(u => u._id) };
        }

        const pending = await Transaction.find(query)
            .populate('userId', 'username phoneNumber')
            .sort({ createdAt: -1 });

        res.json(pending.map(tx => ({
            id: tx._id,
            type: tx.type,
            amount: parseAmount(tx.amount),
            user: tx.userId ? tx.userId.username : 'Unknown',
            userId: tx.userId ? tx.userId._id : null,
            date: tx.createdAt,
            status: tx.status
        })));
    } catch (error) {
        console.error('Error fetching pending transactions:', error);
        res.status(500).json({ message: 'Server error fetching pending items' });
    }
};

exports.approvePendingTransaction = async (req, res) => {
    try {
        const { transactionId } = req.body;
        const transaction = await Transaction.findById(transactionId);

        if (!transaction || transaction.status !== 'pending') {
            return res.status(404).json({ message: 'Pending transaction not found' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user.role === 'agent' && String(user.agentId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized for this transaction' });
        }

        const amount = parseAmount(transaction.amount);
        if (transaction.type === 'deposit') {
            user.balance = parseAmount(user.balance) + amount;
        } else if (transaction.type === 'withdrawal') {
            const newBalance = parseAmount(user.balance) - amount;
            if (newBalance < 0) {
                return res.status(400).json({ message: 'Insufficient balance for withdrawal approval' });
            }
            user.balance = newBalance;
        }

        transaction.status = 'completed';
        await Promise.all([user.save(), transaction.save()]);

        res.json({ message: 'Transaction approved', transactionId: transaction._id });
    } catch (error) {
        console.error('Error approving transaction:', error);
        res.status(500).json({ message: 'Server error approving transaction' });
    }
};

exports.declinePendingTransaction = async (req, res) => {
    try {
        const { transactionId } = req.body;
        const transaction = await Transaction.findById(transactionId);

        if (!transaction || transaction.status !== 'pending') {
            return res.status(404).json({ message: 'Pending transaction not found' });
        }

        transaction.status = 'failed';
        await transaction.save();

        res.json({ message: 'Transaction declined', transactionId: transaction._id });
    } catch (error) {
        console.error('Error declining transaction:', error);
        res.status(500).json({ message: 'Server error declining transaction' });
    }
};

// Messaging
exports.getMessages = async (req, res) => {
    try {
        const status = req.query.status;
        const filter = status ? { status } : {};
        const messages = await Message.find(filter).sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error fetching messages' });
    }
};

exports.markMessageRead = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        message.read = true;
        await message.save();
        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('Error marking message read:', error);
        res.status(500).json({ message: 'Server error updating message' });
    }
};

exports.replyToMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;
        if (!reply || !reply.trim()) {
            return res.status(400).json({ message: 'Reply is required' });
        }

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        message.replies.push({
            adminId: req.user._id,
            message: reply.trim()
        });
        message.read = true;
        await message.save();

        res.json({ message: 'Reply sent', id: message._id });
    } catch (error) {
        console.error('Error replying to message:', error);
        res.status(500).json({ message: 'Server error sending reply' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.findByIdAndDelete(id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Server error deleting message' });
    }
};

// Game Administration
exports.getAdminMatches = async (req, res) => {
    try {
        const matches = await Match.find().sort({ startTime: 1 });

        const betStats = await Bet.aggregate([
            {
                $group: {
                    _id: '$matchId',
                    totalWagered: { $sum: { $toDouble: '$amount' } },
                    totalPayouts: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'won'] },
                                { $toDouble: '$potentialPayout' },
                                0
                            ]
                        }
                    },
                    activeBets: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'pending'] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const statsMap = new Map();
        betStats.forEach(stat => {
            statsMap.set(stat._id.toString(), {
                activeBets: stat.activeBets || 0,
                revenue: (stat.totalWagered || 0) - (stat.totalPayouts || 0)
            });
        });

        const response = matches.map(match => {
            const stats = statsMap.get(match._id.toString()) || { activeBets: 0, revenue: 0 };
            return {
                id: match._id,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                startTime: match.startTime,
                status: match.status,
                sport: match.sport,
                activeBets: stats.activeBets,
                revenue: stats.revenue
            };
        });

        res.json(response);
    } catch (error) {
        console.error('Error fetching admin matches:', error);
        res.status(500).json({ message: 'Server error fetching matches' });
    }
};

exports.createMatch = async (req, res) => {
    try {
        const { homeTeam, awayTeam, startTime, sport, status } = req.body;
        if (!homeTeam || !awayTeam || !startTime || !sport) {
            return res.status(400).json({ message: 'homeTeam, awayTeam, startTime, and sport are required' });
        }

        const match = await Match.create({
            homeTeam,
            awayTeam,
            startTime,
            sport,
            status: status || 'scheduled'
        });

        res.status(201).json(match);
    } catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({ message: 'Server error creating match' });
    }
};

exports.updateMatch = async (req, res) => {
    try {
        const { id } = req.params;
        const { homeTeam, awayTeam, startTime, sport, status, score, odds, lastUpdated } = req.body;

        const match = await Match.findById(id);
        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }

        if (homeTeam) match.homeTeam = homeTeam;
        if (awayTeam) match.awayTeam = awayTeam;
        if (startTime) match.startTime = startTime;
        if (sport) match.sport = sport;
        if (status) match.status = status;
        if (score !== undefined) match.score = score;
        if (odds !== undefined) match.odds = odds;
        if (lastUpdated) match.lastUpdated = lastUpdated;

        await match.save();
        res.json(match);
    } catch (error) {
        console.error('Error updating match:', error);
        res.status(500).json({ message: 'Server error updating match' });
    }
};

// Cashier
exports.getCashierSummary = async (req, res) => {
    try {
        const startOfDay = getStartOfDay(new Date());

        const [depositSum, withdrawalSum, pendingCount] = await Promise.all([
            Transaction.aggregate([
                { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: startOfDay } } },
                { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
            ]),
            Transaction.aggregate([
                { $match: { type: 'withdrawal', status: 'completed', createdAt: { $gte: startOfDay } } },
                { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
            ]),
            Transaction.countDocuments({ status: 'pending' })
        ]);

        res.json({
            totalDeposits: depositSum[0]?.total || 0,
            totalWithdrawals: withdrawalSum[0]?.total || 0,
            pendingCount
        });
    } catch (error) {
        console.error('Error fetching cashier summary:', error);
        res.status(500).json({ message: 'Server error fetching cashier summary' });
    }
};

exports.getCashierTransactions = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
        const transactions = await Transaction.find()
            .populate('userId', 'username phoneNumber')
            .sort({ createdAt: -1 })
            .limit(limit);

        const formatted = transactions.map(tx => ({
            id: tx._id,
            type: tx.type,
            user: tx.userId ? tx.userId.username : 'Unknown',
            amount: parseAmount(tx.amount),
            date: tx.createdAt,
            status: tx.status
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Error fetching cashier transactions:', error);
        res.status(500).json({ message: 'Server error fetching cashier transactions' });
    }
};

// Third Party Limits
exports.getThirdPartyLimits = async (req, res) => {
    try {
        const limits = await ThirdPartyLimit.find().sort({ provider: 1 });
        const formatted = limits.map(limit => ({
            id: limit._id,
            provider: limit.provider,
            dailyLimit: parseAmount(limit.dailyLimit),
            monthlyLimit: parseAmount(limit.monthlyLimit),
            used: parseAmount(limit.used),
            status: limit.status,
            lastSync: limit.lastSync
        }));
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching third party limits:', error);
        res.status(500).json({ message: 'Server error fetching third party limits' });
    }
};

exports.updateThirdPartyLimit = async (req, res) => {
    try {
        const { id } = req.params;
        const { provider, dailyLimit, monthlyLimit, used, status } = req.body;

        const limit = await ThirdPartyLimit.findById(id);
        if (!limit) {
            return res.status(404).json({ message: 'Limit record not found' });
        }

        if (provider) limit.provider = provider;
        if (dailyLimit !== undefined) limit.dailyLimit = dailyLimit;
        if (monthlyLimit !== undefined) limit.monthlyLimit = monthlyLimit;
        if (used !== undefined) limit.used = used;
        if (status) limit.status = status;
        limit.lastSync = new Date();

        await limit.save();

        res.json({
            message: 'Limit updated',
            limit: {
                id: limit._id,
                provider: limit.provider,
                dailyLimit: parseAmount(limit.dailyLimit),
                monthlyLimit: parseAmount(limit.monthlyLimit),
                used: parseAmount(limit.used),
                status: limit.status,
                lastSync: limit.lastSync
            }
        });
    } catch (error) {
        console.error('Error updating third party limit:', error);
        res.status(500).json({ message: 'Server error updating third party limit' });
    }
};

exports.createThirdPartyLimit = async (req, res) => {
    try {
        const { provider, dailyLimit, monthlyLimit, used, status } = req.body;
        if (!provider) {
            return res.status(400).json({ message: 'Provider is required' });
        }

        const existing = await ThirdPartyLimit.findOne({ provider });
        if (existing) {
            return res.status(409).json({ message: 'Provider already exists' });
        }

        const limit = await ThirdPartyLimit.create({
            provider,
            dailyLimit: dailyLimit || 0,
            monthlyLimit: monthlyLimit || 0,
            used: used || 0,
            status: status || 'active'
        });

        res.status(201).json({
            message: 'Limit created',
            limit: {
                id: limit._id,
                provider: limit.provider,
                dailyLimit: parseAmount(limit.dailyLimit),
                monthlyLimit: parseAmount(limit.monthlyLimit),
                used: parseAmount(limit.used),
                status: limit.status,
                lastSync: limit.lastSync
            }
        });
    } catch (error) {
        console.error('Error creating third party limit:', error);
        res.status(500).json({ message: 'Server error creating third party limit' });
    }
};

// Admin Betting (Props) List
exports.getAdminBets = async (req, res) => {
    try {
        const { agent, customer, type, time, amount } = req.query;
        const limitValue = Math.min(parseInt(req.query.limit || '200', 10), 500);

        let agentDoc = null;
        if (agent) {
            agentDoc = await User.findOne({ role: 'agent', username: { $regex: agent, $options: 'i' } }).select('_id username');
            if (!agentDoc) {
                return res.json({ bets: [], totals: { risk: 0, toWin: 0 } });
            }
        }

        const userQuery = { role: 'user' };
        if (customer) userQuery.username = { $regex: customer, $options: 'i' };
        if (agentDoc) userQuery.agentId = agentDoc._id;

        const users = await User.find(userQuery).select('_id username agentId');
        const userIds = users.map(u => u._id);
        if (!userIds.length) {
            return res.json({ bets: [], totals: { risk: 0, toWin: 0 } });
        }

        const betQuery = { userId: { $in: userIds } };
        if (type && type !== 'all-types') betQuery.type = type;
        const startDate = getStartDateFromPeriod(time);
        if (startDate) betQuery.createdAt = { $gte: startDate };

        let bets = await Bet.find(betQuery)
            .populate('userId', 'username agentId')
            .populate('matchId', 'homeTeam awayTeam sport')
            .sort({ createdAt: -1 })
            .limit(limitValue);

        if (amount && amount !== 'any') {
            bets = bets.filter(bet => {
                const wager = parseAmount(bet.amount);
                if (amount === 'under-100') return wager < 100;
                if (amount === '100-500') return wager >= 100 && wager <= 500;
                if (amount === '500-1000') return wager > 500 && wager <= 1000;
                if (amount === 'over-1000') return wager > 1000;
                return true;
            });
        }

        const agentIds = Array.from(
            new Set(
                bets
                    .map(bet => bet.userId?.agentId)
                    .filter(Boolean)
                    .map(id => id.toString())
            )
        );
        const agentMap = new Map();
        if (agentIds.length) {
            const agentUsers = await User.find({ _id: { $in: agentIds } }).select('username');
            agentUsers.forEach(agentUser => {
                agentMap.set(agentUser._id.toString(), agentUser.username);
            });
        }

        let totalRisk = 0;
        let totalToWin = 0;

        const formatted = bets.map(bet => {
            const risk = parseAmount(bet.amount);
            const toWin = parseAmount(bet.potentialPayout);
            totalRisk += risk;
            totalToWin += toWin;

            const match = bet.matchId;
            const matchLabel = match ? `${match.homeTeam} vs ${match.awayTeam}` : 'Match';
            const oddsLabel = bet.odds ? `@ ${bet.odds}` : '';

            return {
                id: bet._id,
                agent: bet.userId?.agentId ? agentMap.get(bet.userId.agentId.toString()) || '—' : '—',
                customer: bet.userId?.username || 'Unknown',
                accepted: bet.createdAt,
                description: `${matchLabel} | ${bet.selection} ${oddsLabel}`.trim(),
                risk,
                toWin,
                type: bet.type,
                status: bet.status
            };
        });

        res.json({
            bets: formatted,
            totals: {
                risk: totalRisk,
                toWin: totalToWin
            }
        });
    } catch (error) {
        console.error('Error fetching admin bets:', error);
        res.status(500).json({ message: 'Server error fetching bets' });
    }
};

exports.createAdminBet = async (req, res) => {
    try {
        const { userId, matchId, amount, odds, type, selection, status } = req.body;
        if (!userId || !matchId || !amount || !odds || !type || !selection) {
            return res.status(400).json({ message: 'userId, matchId, amount, odds, type, and selection are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const match = await Match.findById(matchId);
        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }

        const betAmount = parseAmount(amount);
        const betOdds = parseAmount(odds);
        const potentialPayout = betAmount * betOdds;

        const bet = await Bet.create({
            userId,
            matchId,
            amount: betAmount,
            odds: betOdds,
            type,
            selection,
            potentialPayout,
            status: status || 'pending'
        });

        res.status(201).json({
            message: 'Bet created',
            bet: {
                id: bet._id,
                userId: bet.userId,
                matchId: bet.matchId,
                amount: parseAmount(bet.amount),
                odds: parseAmount(bet.odds),
                potentialPayout: parseAmount(bet.potentialPayout),
                type: bet.type,
                selection: bet.selection,
                status: bet.status,
                createdAt: bet.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating admin bet:', error);
        res.status(500).json({ message: 'Server error creating bet' });
    }
};

// IP Tracker
exports.getIpTracker = async (req, res) => {
    try {
        const { search, status } = req.query;
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

        const query = {};
        if (status && status !== 'all') query.status = status;

        if (search) {
            const users = await User.find({ username: { $regex: search, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);
            query.$or = [
                { ip: { $regex: search, $options: 'i' } },
                { userId: { $in: userIds } }
            ];
        }

        const logs = await IpLog.find(query)
            .populate('userId', 'username phoneNumber')
            .sort({ lastActive: -1 })
            .limit(limit);

        const formatted = logs.map(log => ({
            id: log._id,
            ip: log.ip,
            user: log.userId?.username || 'Unknown',
            userId: log.userId?._id || null,
            country: log.country || 'Unknown',
            city: log.city || 'Unknown',
            lastActive: log.lastActive,
            status: log.status,
            userAgent: log.userAgent
        }));

        res.json({ logs: formatted });
    } catch (error) {
        console.error('Error fetching IP tracker:', error);
        res.status(500).json({ message: 'Server error fetching IP tracker' });
    }
};

exports.blockIp = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await IpLog.findById(id);
        if (!log) return res.status(404).json({ message: 'IP record not found' });

        log.status = 'blocked';
        log.blockedAt = new Date();
        log.blockedBy = req.user?._id || null;
        await log.save();

        res.json({ message: 'IP blocked', id: log._id });
    } catch (error) {
        console.error('Error blocking IP:', error);
        res.status(500).json({ message: 'Server error blocking IP' });
    }
};

exports.unblockIp = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await IpLog.findById(id);
        if (!log) return res.status(404).json({ message: 'IP record not found' });

        log.status = 'active';
        log.blockedAt = null;
        log.blockedBy = null;
        await log.save();

        res.json({ message: 'IP unblocked', id: log._id });
    } catch (error) {
        console.error('Error unblocking IP:', error);
        res.status(500).json({ message: 'Server error unblocking IP' });
    }
};

// Transactions History
exports.getTransactionsHistory = async (req, res) => {
    try {
        const { user, type, status, time } = req.query;
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

        const query = {};
        if (type && type !== 'all') query.type = type;
        if (status && status !== 'all') query.status = status;

        const startDate = getStartDateFromPeriod(time);
        if (startDate) query.createdAt = { $gte: startDate };

        if (user) {
            const users = await User.find({ username: { $regex: user, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);
            query.userId = { $in: userIds };
        }

        const transactions = await Transaction.find(query)
            .populate('userId', 'username phoneNumber')
            .sort({ createdAt: -1 })
            .limit(limit);

        const formatted = transactions.map(tx => ({
            id: tx._id,
            type: tx.type,
            user: tx.userId?.username || 'Unknown',
            userId: tx.userId?._id || null,
            amount: parseAmount(tx.amount),
            date: tx.createdAt,
            status: tx.status,
            description: tx.description || null
        }));

        res.json({ transactions: formatted });
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ message: 'Server error fetching transaction history' });
    }
};

// Collections
exports.getCollections = async (req, res) => {
    try {
        const { status, user, overdue } = req.query;
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

        const query = {};
        if (status && status !== 'all') query.status = status;

        if (user) {
            const users = await User.find({ username: { $regex: user, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);
            query.userId = { $in: userIds };
        }

        if (overdue === '1') {
            query.dueDate = { $lt: new Date() };
            query.status = { $ne: 'collected' };
        }

        const collections = await Collection.find(query)
            .populate('userId', 'username phoneNumber')
            .sort({ createdAt: -1 })
            .limit(limit);

        const formatted = collections.map(col => ({
            id: col._id,
            user: col.userId?.username || 'Unknown',
            userId: col.userId?._id || null,
            amount: parseAmount(col.amount),
            dueDate: col.dueDate,
            status: col.status,
            attempts: col.attempts || 0,
            lastAttemptAt: col.lastAttemptAt,
            notes: col.notes || null,
            createdAt: col.createdAt
        }));

        const totalOutstanding = formatted
            .filter(col => col.status !== 'collected' && col.status !== 'cancelled')
            .reduce((sum, col) => sum + parseAmount(col.amount), 0);

        res.json({ collections: formatted, summary: { totalOutstanding } });
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ message: 'Server error fetching collections' });
    }
};

exports.createCollection = async (req, res) => {
    try {
        const { userId, amount, dueDate, notes } = req.body;
        if (!userId || !amount) {
            return res.status(400).json({ message: 'userId and amount are required' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const parsedAmount = parseAmount(amount);
        const due = dueDate ? new Date(dueDate) : null;
        const status = due && due < new Date() ? 'overdue' : 'pending';

        const collection = await Collection.create({
            userId,
            amount: parsedAmount,
            dueDate: due,
            status,
            notes: notes || null,
            createdBy: req.user?._id || null
        });

        res.status(201).json({
            message: 'Collection created',
            collection: {
                id: collection._id,
                userId: collection.userId,
                amount: parseAmount(collection.amount),
                dueDate: collection.dueDate,
                status: collection.status,
                attempts: collection.attempts,
                notes: collection.notes,
                createdAt: collection.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({ message: 'Server error creating collection' });
    }
};

exports.collectCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const collection = await Collection.findById(id);
        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        collection.status = 'collected';
        collection.attempts = (collection.attempts || 0) + 1;
        collection.lastAttemptAt = new Date();
        await collection.save();

        res.json({ message: 'Collection marked as collected', id: collection._id });
    } catch (error) {
        console.error('Error collecting:', error);
        res.status(500).json({ message: 'Server error collecting' });
    }
};

exports.getCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const collection = await Collection.findById(id).populate('userId', 'username phoneNumber');
        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        res.json({
            id: collection._id,
            user: collection.userId?.username || 'Unknown',
            userId: collection.userId?._id || null,
            amount: parseAmount(collection.amount),
            dueDate: collection.dueDate,
            status: collection.status,
            attempts: collection.attempts || 0,
            lastAttemptAt: collection.lastAttemptAt,
            notes: collection.notes || null,
            createdAt: collection.createdAt
        });
    } catch (error) {
        console.error('Error fetching collection:', error);
        res.status(500).json({ message: 'Server error fetching collection' });
    }
};

// Deleted Wagers
exports.getDeletedWagers = async (req, res) => {
    try {
        const { user, sport, status, time } = req.query;
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

        const query = {};
        if (status && status !== 'all') query.status = status;
        if (sport && sport !== 'all') query.sport = sport;

        const startDate = getStartDateFromPeriod(time);
        if (startDate) query.deletedAt = { $gte: startDate };

        if (user) {
            const users = await User.find({ username: { $regex: user, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);
            query.userId = { $in: userIds };
        }

        const wagers = await DeletedWager.find(query)
            .populate('userId', 'username phoneNumber')
            .sort({ deletedAt: -1 })
            .limit(limit);

        const formatted = wagers.map(wager => ({
            id: wager._id,
            user: wager.userId?.username || 'Unknown',
            userId: wager.userId?._id || null,
            amount: parseAmount(wager.amount),
            sport: wager.sport,
            reason: wager.reason,
            status: wager.status,
            deletedAt: wager.deletedAt,
            restoredAt: wager.restoredAt
        }));

        res.json({ wagers: formatted });
    } catch (error) {
        console.error('Error fetching deleted wagers:', error);
        res.status(500).json({ message: 'Server error fetching deleted wagers' });
    }
};

exports.restoreDeletedWager = async (req, res) => {
    try {
        const { id } = req.params;
        const wager = await DeletedWager.findById(id);
        if (!wager) return res.status(404).json({ message: 'Deleted wager not found' });

        wager.status = 'restored';
        wager.restoredAt = new Date();
        wager.restoredBy = req.user?._id || null;
        await wager.save();

        res.json({ message: 'Wager restored', id: wager._id });
    } catch (error) {
        console.error('Error restoring wager:', error);
        res.status(500).json({ message: 'Server error restoring wager' });
    }
};

// Sportsbook Links
exports.getSportsbookLinks = async (req, res) => {
    try {
        const links = await SportsbookLink.find().sort({ name: 1 });
        const formatted = links.map(link => ({
            id: link._id,
            name: link.name,
            url: link.url,
            status: link.status,
            lastSync: link.lastSync,
            notes: link.notes
        }));
        res.json({ links: formatted });
    } catch (error) {
        console.error('Error fetching sportsbook links:', error);
        res.status(500).json({ message: 'Server error fetching sportsbook links' });
    }
};

exports.createSportsbookLink = async (req, res) => {
    try {
        const { name, url, status, notes } = req.body;
        if (!name || !url) {
            return res.status(400).json({ message: 'name and url are required' });
        }

        const existing = await SportsbookLink.findOne({ name });
        if (existing) return res.status(409).json({ message: 'Provider already exists' });

        const link = await SportsbookLink.create({
            name,
            url,
            status: status || 'active',
            notes: notes || null,
            createdBy: req.user?._id || null
        });

        res.status(201).json({
            message: 'Link created',
            link: {
                id: link._id,
                name: link.name,
                url: link.url,
                status: link.status,
                lastSync: link.lastSync,
                notes: link.notes
            }
        });
    } catch (error) {
        console.error('Error creating sportsbook link:', error);
        res.status(500).json({ message: 'Server error creating sportsbook link' });
    }
};

exports.updateSportsbookLink = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, url, status, notes } = req.body;

        const link = await SportsbookLink.findById(id);
        if (!link) return res.status(404).json({ message: 'Link not found' });

        if (name) link.name = name;
        if (url) link.url = url;
        if (status) link.status = status;
        if (notes !== undefined) link.notes = notes;
        await link.save();

        res.json({ message: 'Link updated', id: link._id });
    } catch (error) {
        console.error('Error updating sportsbook link:', error);
        res.status(500).json({ message: 'Server error updating sportsbook link' });
    }
};

exports.testSportsbookLink = async (req, res) => {
    try {
        const { id } = req.params;
        const link = await SportsbookLink.findById(id);
        if (!link) return res.status(404).json({ message: 'Link not found' });

        link.lastSync = new Date();
        await link.save();

        res.json({ message: 'Link tested', id: link._id, lastSync: link.lastSync });
    } catch (error) {
        console.error('Error testing sportsbook link:', error);
        res.status(500).json({ message: 'Server error testing link' });
    }
};

// Clear Cache
exports.clearCache = async (_req, res) => {
    try {
        const oddsService = require('../services/oddsService');
        oddsService.clearCache();
        res.json({ message: 'Cache cleared' });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ message: 'Server error clearing cache' });
    }
};

// Billing
exports.getBillingSummary = async (_req, res) => {
    try {
        const invoices = await BillingInvoice.find();
        const totals = invoices.reduce(
            (acc, invoice) => {
                const amount = parseAmount(invoice.amount);
                if (invoice.status === 'paid') acc.paid += amount;
                if (invoice.status === 'pending' || invoice.status === 'overdue') acc.outstanding += amount;
                acc.total += amount;
                return acc;
            },
            { paid: 0, outstanding: 0, total: 0 }
        );

        res.json(totals);
    } catch (error) {
        console.error('Error fetching billing summary:', error);
        res.status(500).json({ message: 'Server error fetching billing summary' });
    }
};

exports.getBillingInvoices = async (req, res) => {
    try {
        const { status } = req.query;
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

        const query = {};
        if (status && status !== 'all') query.status = status;

        const invoices = await BillingInvoice.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);

        const formatted = invoices.map(inv => ({
            id: inv._id,
            invoice: inv.invoiceNumber,
            amount: parseAmount(inv.amount),
            status: inv.status,
            date: inv.createdAt,
            dueDate: inv.dueDate,
            paidAt: inv.paidAt,
            notes: inv.notes
        }));

        res.json({ invoices: formatted });
    } catch (error) {
        console.error('Error fetching billing invoices:', error);
        res.status(500).json({ message: 'Server error fetching billing invoices' });
    }
};

exports.createBillingInvoice = async (req, res) => {
    try {
        const { invoiceNumber, amount, status, dueDate, notes } = req.body;
        if (!invoiceNumber || !amount) {
            return res.status(400).json({ message: 'invoiceNumber and amount are required' });
        }

        const existing = await BillingInvoice.findOne({ invoiceNumber });
        if (existing) return res.status(409).json({ message: 'Invoice already exists' });

        const invoice = await BillingInvoice.create({
            invoiceNumber,
            amount: parseAmount(amount),
            status: status || 'pending',
            dueDate: dueDate ? new Date(dueDate) : null,
            notes: notes || null,
            createdBy: req.user?._id || null,
            paidAt: status === 'paid' ? new Date() : null
        });

        res.status(201).json({
            message: 'Invoice created',
            invoice: {
                id: invoice._id,
                invoice: invoice.invoiceNumber,
                amount: parseAmount(invoice.amount),
                status: invoice.status,
                date: invoice.createdAt,
                dueDate: invoice.dueDate,
                paidAt: invoice.paidAt,
                notes: invoice.notes
            }
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ message: 'Server error creating invoice' });
    }
};

exports.updateBillingInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, status, dueDate, notes } = req.body;

        const invoice = await BillingInvoice.findById(id);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        if (amount !== undefined) invoice.amount = parseAmount(amount);
        if (status) {
            invoice.status = status;
            if (status === 'paid') invoice.paidAt = new Date();
        }
        if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : null;
        if (notes !== undefined) invoice.notes = notes;

        await invoice.save();
        res.json({ message: 'Invoice updated', id: invoice._id });
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ message: 'Server error updating invoice' });
    }
};

exports.getBillingInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await BillingInvoice.findById(id);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        res.json({
            id: invoice._id,
            invoice: invoice.invoiceNumber,
            amount: parseAmount(invoice.amount),
            status: invoice.status,
            date: invoice.createdAt,
            dueDate: invoice.dueDate,
            paidAt: invoice.paidAt,
            notes: invoice.notes
        });
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ message: 'Server error fetching invoice' });
    }
};

// Settings
exports.getSettings = async (_req, res) => {
    try {
        let settings = await PlatformSetting.findOne();
        if (!settings) {
            settings = await PlatformSetting.create({});
        }
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server error fetching settings' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        let settings = await PlatformSetting.findOne();
        if (!settings) {
            settings = await PlatformSetting.create({});
        }

        const fields = [
            'platformName',
            'dailyBetLimit',
            'weeklyBetLimit',
            'maxOdds',
            'minBet',
            'maxBet',
            'maintenanceMode',
            'smsNotifications',
            'twoFactor'
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined) settings[field] = req.body[field];
        });

        await settings.save();
        res.json({ message: 'Settings updated', settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Server error updating settings' });
    }
};

// Rules
exports.getRules = async (_req, res) => {
    try {
        const rules = await Rule.find().sort({ createdAt: -1 });
        res.json({ rules });
    } catch (error) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ message: 'Server error fetching rules' });
    }
};

exports.createRule = async (req, res) => {
    try {
        const { title, items, status } = req.body;
        if (!title) return res.status(400).json({ message: 'title is required' });
        const rule = await Rule.create({
            title,
            items: Array.isArray(items) ? items : [],
            status: status || 'active'
        });
        res.status(201).json({ message: 'Rule created', rule });
    } catch (error) {
        console.error('Error creating rule:', error);
        res.status(500).json({ message: 'Server error creating rule' });
    }
};

exports.updateRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, items, status } = req.body;
        const rule = await Rule.findById(id);
        if (!rule) return res.status(404).json({ message: 'Rule not found' });

        if (title) rule.title = title;
        if (items !== undefined) rule.items = Array.isArray(items) ? items : rule.items;
        if (status) rule.status = status;

        await rule.save();
        res.json({ message: 'Rule updated', id: rule._id });
    } catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json({ message: 'Server error updating rule' });
    }
};

exports.deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await Rule.findById(id);
        if (!rule) return res.status(404).json({ message: 'Rule not found' });
        await rule.deleteOne();
        res.json({ message: 'Rule deleted', id });
    } catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ message: 'Server error deleting rule' });
    }
};

// Feedback
exports.getFeedback = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && status !== 'all') query.status = status;

        const feedbacks = await Feedback.find(query)
            .populate('userId', 'username phoneNumber')
            .sort({ createdAt: -1 });

        const formatted = feedbacks.map(item => ({
            id: item._id,
            user: item.userId?.username || item.userLabel || 'Anonymous',
            message: item.message,
            rating: item.rating,
            status: item.status,
            adminReply: item.adminReply,
            repliedAt: item.repliedAt,
            date: item.createdAt
        }));

        res.json({ feedbacks: formatted });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ message: 'Server error fetching feedback' });
    }
};

exports.replyFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;
        if (!reply) return res.status(400).json({ message: 'reply is required' });

        const feedback = await Feedback.findById(id);
        if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

        feedback.adminReply = reply;
        feedback.repliedAt = new Date();
        await feedback.save();

        res.json({ message: 'Reply saved', id: feedback._id });
    } catch (error) {
        console.error('Error replying feedback:', error);
        res.status(500).json({ message: 'Server error replying feedback' });
    }
};

exports.markFeedbackReviewed = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await Feedback.findById(id);
        if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

        feedback.status = 'reviewed';
        await feedback.save();
        res.json({ message: 'Feedback reviewed', id: feedback._id });
    } catch (error) {
        console.error('Error updating feedback:', error);
        res.status(500).json({ message: 'Server error updating feedback' });
    }
};

exports.deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await Feedback.findById(id);
        if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
        await feedback.deleteOne();
        res.json({ message: 'Feedback deleted', id });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ message: 'Server error deleting feedback' });
    }
};

// FAQ
exports.getFaqs = async (_req, res) => {
    try {
        const faqs = await Faq.find().sort({ order: 1, createdAt: -1 });
        res.json({ faqs });
    } catch (error) {
        console.error('Error fetching FAQs:', error);
        res.status(500).json({ message: 'Server error fetching FAQs' });
    }
};

exports.createFaq = async (req, res) => {
    try {
        const { question, answer, status, order } = req.body;
        if (!question || !answer) return res.status(400).json({ message: 'question and answer are required' });
        const faq = await Faq.create({ question, answer, status: status || 'active', order: order || 0 });
        res.status(201).json({ message: 'FAQ created', faq });
    } catch (error) {
        console.error('Error creating FAQ:', error);
        res.status(500).json({ message: 'Server error creating FAQ' });
    }
};

exports.updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, status, order } = req.body;
        const faq = await Faq.findById(id);
        if (!faq) return res.status(404).json({ message: 'FAQ not found' });

        if (question) faq.question = question;
        if (answer) faq.answer = answer;
        if (status) faq.status = status;
        if (order !== undefined) faq.order = order;

        await faq.save();
        res.json({ message: 'FAQ updated', id: faq._id });
    } catch (error) {
        console.error('Error updating FAQ:', error);
        res.status(500).json({ message: 'Server error updating FAQ' });
    }
};

exports.deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await Faq.findById(id);
        if (!faq) return res.status(404).json({ message: 'FAQ not found' });
        await faq.deleteOne();
        res.json({ message: 'FAQ deleted', id });
    } catch (error) {
        console.error('Error deleting FAQ:', error);
        res.status(500).json({ message: 'Server error deleting FAQ' });
    }
};

// User Manual
exports.getManualSections = async (_req, res) => {
    try {
        const sections = await ManualSection.find({ status: 'active' }).sort({ order: 1, createdAt: -1 });
        res.json({ sections });
    } catch (error) {
        console.error('Error fetching manual sections:', error);
        res.status(500).json({ message: 'Server error fetching manual sections' });
    }
};

exports.createManualSection = async (req, res) => {
    try {
        const { title, content, order, status } = req.body;
        if (!title || !content) return res.status(400).json({ message: 'title and content are required' });
        const section = await ManualSection.create({
            title,
            content,
            order: order || 0,
            status: status || 'active'
        });
        res.status(201).json({ message: 'Section created', section });
    } catch (error) {
        console.error('Error creating manual section:', error);
        res.status(500).json({ message: 'Server error creating manual section' });
    }
};

exports.updateManualSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, order, status } = req.body;
        const section = await ManualSection.findById(id);
        if (!section) return res.status(404).json({ message: 'Section not found' });

        if (title) section.title = title;
        if (content) section.content = content;
        if (order !== undefined) section.order = order;
        if (status) section.status = status;

        await section.save();
        res.json({ message: 'Section updated', id: section._id });
    } catch (error) {
        console.error('Error updating manual section:', error);
        res.status(500).json({ message: 'Server error updating manual section' });
    }
};

exports.deleteManualSection = async (req, res) => {
    try {
        const { id } = req.params;
        const section = await ManualSection.findById(id);
        if (!section) return res.status(404).json({ message: 'Section not found' });
        await section.deleteOne();
        res.json({ message: 'Section deleted', id });
    } catch (error) {
        console.error('Error deleting manual section:', error);
        res.status(500).json({ message: 'Server error deleting manual section' });
    }
};

// Agent Performance
exports.getAgentPerformance = async (req, res) => {
    try {
        const period = req.query.period || '30d';
        const startDate = getStartDateFromPeriod(period);

        const agents = await Agent.find().select('username status createdAt');
        const agentIds = agents.map(agent => agent._id);
        if (!agentIds.length) {
            return res.json({ agents: [], summary: { revenue: 0, customers: 0, avgWinRate: 0, upAgents: 0 } });
        }

        const users = await User.find({ role: 'user', agentId: { $in: agentIds } }).select('_id agentId');
        const userToAgent = new Map();
        const agentToCustomers = new Map();

        users.forEach(user => {
            const agentId = user.agentId?.toString();
            if (!agentId) return;
            userToAgent.set(user._id.toString(), agentId);
            if (!agentToCustomers.has(agentId)) agentToCustomers.set(agentId, []);
            agentToCustomers.get(agentId).push(user._id.toString());
        });

        const betQuery = { userId: { $in: users.map(u => u._id) } };
        if (startDate) betQuery.createdAt = { $gte: startDate };

        const bets = await Bet.find(betQuery).select('userId amount potentialPayout status createdAt');

        const agentStats = new Map();
        const ensure = (agentId) => {
            if (!agentStats.has(agentId)) {
                agentStats.set(agentId, {
                    revenue: 0,
                    wagered: 0,
                    payouts: 0,
                    wins: 0,
                    losses: 0,
                    lastActive: null
                });
            }
            return agentStats.get(agentId);
        };

        bets.forEach(bet => {
            const agentId = userToAgent.get(bet.userId.toString());
            if (!agentId) return;
            const stat = ensure(agentId);
            const wager = parseAmount(bet.amount);
            const payout = bet.status === 'won' ? parseAmount(bet.potentialPayout) : 0;
            stat.wagered += wager;
            stat.payouts += payout;
            if (bet.status === 'won') stat.wins += 1;
            if (bet.status === 'lost') stat.losses += 1;
            if (!stat.lastActive || new Date(bet.createdAt) > stat.lastActive) {
                stat.lastActive = new Date(bet.createdAt);
            }
        });

        let totalRevenue = 0;
        let totalCustomers = 0;
        let totalWinRate = 0;
        let upAgents = 0;

        const formattedAgents = agents.map(agent => {
            const agentId = agent._id.toString();
            const stat = ensure(agentId);
            const customerCount = agentToCustomers.get(agentId)?.length || 0;
            const totalDecisions = stat.wins + stat.losses;
            const winRate = totalDecisions ? (stat.wins / totalDecisions) * 100 : 0;
            const revenue = stat.wagered - stat.payouts;

            totalRevenue += revenue;
            totalCustomers += customerCount;
            totalWinRate += winRate;

            const trend = winRate >= 52 ? 'up' : winRate <= 48 ? 'down' : 'stable';
            if (trend === 'up') upAgents += 1;

            const tier = revenue >= 15000 ? 'gold' : revenue >= 9000 ? 'silver' : 'bronze';

            return {
                id: agent._id,
                name: agent.username,
                revenue,
                customers: customerCount,
                winRate: Number(winRate.toFixed(1)),
                trend,
                lastActive: stat.lastActive ? stat.lastActive : agent.createdAt,
                tier
            };
        });

        const avgWinRate = formattedAgents.length ? totalWinRate / formattedAgents.length : 0;

        res.json({
            agents: formattedAgents,
            summary: {
                revenue: totalRevenue,
                customers: totalCustomers,
                avgWinRate: Number(avgWinRate.toFixed(1)),
                upAgents
            }
        });
    } catch (error) {
        console.error('Error fetching agent performance:', error);
        res.status(500).json({ message: 'Server error fetching agent performance' });
    }
};
// Get Detailed User Statistics
exports.getUserStats = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find user and populate creator
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Determine Creator Details
        let creator = null;
        if (user.createdBy) {
            if (user.createdByModel === 'Admin') {
                const admin = await Admin.findById(user.createdBy);
                if (admin) creator = { username: admin.username, role: 'Admin' };
            } else if (user.createdByModel === 'Agent') {
                const agent = await Agent.findById(user.createdBy);
                if (agent) creator = { username: agent.username, role: 'Agent' };
            }
        }

        // Find Agent if assigned
        let agent = null;
        if (user.agentId) {
            const agentDoc = await Agent.findById(user.agentId);
            if (agentDoc) agent = { username: agentDoc.username };
        }

        // Aggregate Betting Stats
        const bettingStats = await Bet.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: null,
                    totalBets: { $sum: 1 },
                    totalWagered: { $sum: '$wagerAmount' },
                    totalWon: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, '$payout', 0] } },
                    wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
                    losses: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
                    voids: { $sum: { $cond: [{ $eq: ['$status', 'void'] }, 1, 0] } },
                    lastBetDate: { $max: '$createdAt' }
                }
            }
        ]);

        const stats = bettingStats[0] || {
            totalBets: 0,
            totalWagered: 0,
            totalWon: 0,
            wins: 0,
            losses: 0,
            voids: 0,
            lastBetDate: null
        };

        stats.netProfit = stats.totalWon - stats.totalWagered;

        res.status(200).json({
            user: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                status: user.status,
                balance: user.balance,
                creditLimit: user.creditLimit,
                balanceOwed: user.balanceOwed,
                createdAt: user.createdAt
            },
            creator,
            agent,
            stats
        });

    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ message: 'Server error fetching user stats' });
    }
};
// Impersonate a user
exports.impersonateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Only admins can impersonate (or agents for their own users)
        if (req.user.role === 'agent' && String(user.agentId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Unauthorized to impersonate this user' });
        }

        const payload = buildAuthPayload(user);
        res.json({ ...payload, message: `Logged in as ${user.username}` });
    } catch (error) {
        console.error('Impersonation error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
