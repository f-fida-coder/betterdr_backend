const { User } = require('../models');

// Middleware to check if the current user (Agent) has access to the target user
const checkAgentAccess = async (req, res, next) => {
    try {
        const targetUserId = req.params.id || req.body.userId;

        // If no target ID is provided, we can't check, so proceed or error depending on route
        // Assuming this middleware is used on routes where an ID is expected
        if (!targetUserId) {
            return res.status(400).json({ message: 'User ID required for access check' });
        }

        const targetUser = await User.findByPk(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Admins can access anyone
        if (req.user.role === 'admin') {
            req.targetUser = targetUser;
            return next();
        }

        // Agents can only access their own users
        if (req.user.role === 'agent') {
            if (targetUser.agentId === req.user.id) {
                req.targetUser = targetUser;
                return next();
            } else {
                return res.status(403).json({ message: 'Not authorized to access this user' });
            }
        }

        // Regular users shouldn't be accessing other users via this middleware usually, 
        // but if they are checking their own ID:
        if (req.user.id === targetUser.id) {
            req.targetUser = targetUser;
            return next();
        }

        res.status(403).json({ message: 'Not authorized' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { checkAgentAccess };
