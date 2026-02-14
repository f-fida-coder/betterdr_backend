const jwt = require('jsonwebtoken');
const { User, Admin, Agent, IpLog } = require('../models');

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
};

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

            // Select Model based on role in token
            if (decoded.role === 'admin') {
                req.user = await Admin.findById(decoded.id).select('-password');
            } else if (decoded.role === 'agent' || decoded.role === 'super_agent') {
                req.user = await Agent.findById(decoded.id).select('-password');
            } else {
                req.user = await User.findById(decoded.id).select('-password');
            }

            if (!req.user) {
                // Fallback: Check other collections if role mismatch or missing (optional, mostly for migration safety)
                if (decoded.role === 'user') {
                    // Check if they were migrated to agent/admin? Unlikely if token says user.
                }
                return res.status(403).json({ message: 'Not authorized, user not found' });
            }

            if (req.user.status === 'suspended') {
                return res.status(403).json({ message: 'Not authorized, account suspended' });
            }

            const ipBlockingEnabled = String(process.env.IP_BLOCKING_ENABLED || 'true').toLowerCase() === 'true';
            const allowlist = (process.env.IP_ALLOWLIST || '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);
            const ip = getClientIp(req);
            if (ip && ip !== 'unknown') {
                if (ipBlockingEnabled && !allowlist.includes(ip)) {
                    const existingIp = await IpLog.findOne({ userId: req.user._id, ip });
                    if (existingIp && existingIp.status === 'blocked') {
                        return res.status(403).json({ message: 'Access blocked for this IP address' });
                    }
                }

                await IpLog.findOneAndUpdate(
                    { userId: req.user._id, ip },
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
            }

            next();
        } catch (error) {
            res.status(401).json({ message: 'Not authorized, token failed: ' + error.message });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
