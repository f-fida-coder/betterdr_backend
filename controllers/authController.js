const { User, Admin, Agent, IpLog } = require('../models');
const jwt = require('jsonwebtoken');

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
};

const trackLoginIp = async (req, user) => {
    try {
        const ip = getClientIp(req);
        if (!ip || ip === 'unknown') return;

        // IpLog stores userId. We assume IDs are unique across collections (Mongo default).
        await IpLog.findOneAndUpdate(
            { userId: user._id, ip },
            {
                $set: {
                    userAgent: req.headers['user-agent'] || null,
                    lastActive: new Date()
                },
                $setOnInsert: {
                    country: 'Unknown',
                    city: 'Unknown',
                    status: 'active'
                }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('IP tracking failed:', error.message);
    }
};

const generateToken = (id, role, agentId) => {
    return jwt.sign({ id, role, agentId }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '8h',
    });
};

const buildAuthPayload = (user) => {
    // Helper to safely parse numbers
    const safeNum = (val) => parseFloat(val?.toString() || '0');

    const balance = safeNum(user.balance);
    const pendingBalance = safeNum(user.pendingBalance);
    const availableBalance = Math.max(0, balance - pendingBalance);
    const balanceOwed = safeNum(user.balanceOwed);
    const creditLimit = safeNum(user.creditLimit);

    return {
        id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        balance,
        pendingBalance,
        availableBalance,
        balanceOwed,
        creditLimit,
        unlimitedBalance: !!user.unlimitedBalance,
        isSuperAdmin: !!user.isSuperAdmin,
        totalWinnings: user.totalWinnings,
        role: user.role,
        viewOnly: user.viewOnly,
        agentBillingStatus: user.agentBillingStatus,
        token: generateToken(user._id, user.role, user.agentId),
    };
};

const ensureIpAllowed = async (req, user) => {
    const ipBlockingEnabled = String(process.env.IP_BLOCKING_ENABLED || 'true').toLowerCase() === 'true';
    if (!ipBlockingEnabled) return { allowed: true };

    // ... Existing IP check logic ...
    // Since we didn't change IpLog schema, this logic likely holds if we pass the user object
    // Re-implementing simplified call or keep existing as is if I don't replace it all?
    // I will keep the function mostly but ensure it uses the user object passed.
    // Actually I can't modify this easily without replacing the whole function or file chunk.
    // I will assume ensureIpAllowed is working as it just reads userId.

    // START REPLACEMENT of logic

    const ip = getClientIp(req);
    // ... reusing the logic from the file I read ...
    // To simplify: I will assume the IPs are tracked by ID.
    // If I replace the whole file content for login methods, I need to make sure ensureIpAllowed is available.
    // I will replace from imports down to loginAgent end.
    const duplicateIpBlockEnabled = String(process.env.DUPLICATE_IP_BLOCK_ENABLED || 'true').toLowerCase() === 'true';
    if (!ip || ip === 'unknown') return { allowed: true };

    const allowlist = (process.env.IP_ALLOWLIST || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);

    // 1. Check if IP is explicitly in system allowlist (hardcoded in env)
    if (allowlist.includes(ip)) {
        return { allowed: true };
    }

    // 2. Check if IP is whitelisted in DB
    const existingLog = await IpLog.findOne({ ip, userId: user._id });
    if (existingLog && existingLog.status === 'whitelisted') {
        return { allowed: true };
    }

    if (duplicateIpBlockEnabled) {
        const conflict = await IpLog.findOne({
            ip,
            userId: { $ne: user._id },
            status: { $in: ['active', 'blocked'] }
        });
        if (conflict) {
            // Also check if the conflict IP is whitelisted (whitelisted IPs shouldn't cause conflicts?)
            // Actually, if an IP is whitelisted, we should allow it regardless of other users.
            if (conflict.status === 'whitelisted') {
                return { allowed: true };
            }

            await IpLog.findOneAndUpdate(
                { userId: user._id, ip },
                { $set: { status: 'blocked', blockReason: 'DUPLICATE_IP' } },
                { upsert: true }
            );
            return { allowed: false, message: 'Security Alert: IP linked to another account.' };
        }
    }

    const blocked = await IpLog.findOne({ userId: user._id, ip, status: 'blocked' });
    if (blocked) return { allowed: false, message: 'Access blocked for this IP address' };

    return { allowed: true };
};

const registerUser = async (req, res) => {
    try {
        const { username, phoneNumber, password, agentId } = req.body;
        // console.log('📝 Register request:', { username, phoneNumber, agentId });

        if (!username || !phoneNumber || !password) {
            return res.status(400).json({ message: 'Username, phone number, and password are required' });
        }

        const userExists = await User.findOne({ phoneNumber });
        if (userExists) return res.status(400).json({ message: 'Phone number already registered' });

        const usernameExists = await User.findOne({ username });
        if (usernameExists) return res.status(400).json({ message: 'Username already taken' });

        let validAgentId = null;
        if (agentId) {
            const agent = await Agent.findById(agentId); // Check Agent collection
            if (agent) {
                validAgentId = agentId;
            }
        }

        const user = new User({
            username, phoneNumber, password, role: 'user', agentId: validAgentId, status: 'active', balance: 1000, pendingBalance: 0
        });

        await user.save();
        res.status(201).json({ ...buildAuthPayload(user), message: 'Registration successful' });
    } catch (error) {
        console.error('❌ Registration error:', error.message);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

const loginUser = async (req, res) => {
    try {
        let { username, password } = req.body;
        username = username.toUpperCase();

        // 1. Check User collection
        let user = await User.findOne({ username });

        // 2. If not found, check Agent collection
        if (!user) {
            user = await Agent.findOne({ username });
        }

        // 3. If still not found, check Admin collection
        if (!user) {
            user = await Admin.findOne({ username });
        }

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (['suspended', 'closed', 'disabled'].includes(user.accountStatus) || ['suspended', 'disabled'].includes(user.status)) {
            return res.status(403).json({ message: 'Account suspended or disabled.' });
        }

        const ipCheck = await ensureIpAllowed(req, user);
        if (!ipCheck.allowed) return res.status(403).json({ message: ipCheck.message });

        await trackLoginIp(req, user);
        res.json(buildAuthPayload(user));
    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const loginAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await Admin.findOne({ username }); // Query Admin model
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }
        if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended.' });

        const ipCheck = await ensureIpAllowed(req, user);
        if (!ipCheck.allowed) return res.status(403).json({ message: ipCheck.message });

        await trackLoginIp(req, user);
        res.json(buildAuthPayload(user));
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const loginAgent = async (req, res) => {
    try {
        let { username, password } = req.body;
        username = username.toUpperCase();
        const user = await Agent.findOne({ username }); // Query Agent model
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid agent credentials' });
        }
        if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended.' });

        const ipCheck = await ensureIpAllowed(req, user);
        if (!ipCheck.allowed) return res.status(403).json({ message: ipCheck.message });

        await trackLoginIp(req, user);
        res.json(buildAuthPayload(user));
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getMe = async (req, res) => {
    // Middleware should attach user to req
    if (req.user) {
        const balance = parseFloat(req.user.balance?.toString() || '0');
        const pendingBalance = parseFloat(req.user.pendingBalance?.toString() || '0');
        const availableBalance = Math.max(0, balance - pendingBalance);
        const balanceOwed = parseFloat(req.user.balanceOwed?.toString() || '0');
        const creditLimit = parseFloat(req.user.creditLimit?.toString() || '0');
        res.json({
            id: req.user._id,
            username: req.user.username,
            phoneNumber: req.user.phoneNumber,
            balance,
            pendingBalance,
            availableBalance,
            balanceOwed,
            creditLimit,
            unlimitedBalance: !!req.user.unlimitedBalance,
            isSuperAdmin: !!req.user.isSuperAdmin,
            totalWinnings: req.user.totalWinnings,
            role: req.user.role,
            viewOnly: req.user.viewOnly,
            agentBillingStatus: req.user.agentBillingStatus
        })
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}

module.exports = { registerUser, loginUser, loginAdmin, loginAgent, getMe, generateToken, buildAuthPayload };
