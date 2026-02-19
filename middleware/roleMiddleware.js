const adminOnly = (req, res, next) => {
    const authorizedRoles = ['admin', 'super_agent', 'master_agent'];
    if (req.user && authorizedRoles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as admin or master agent' });
    }
};

const agentOnly = (req, res, next) => {
    if (req.user && req.user.role === 'agent') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as agent' });
    }
};

const adminOrAgent = (req, res, next) => {
    const roles = ['admin', 'super_agent', 'master_agent', 'agent'];
    if (req.user && roles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized' });
    }
};

module.exports = { adminOnly, agentOnly, adminOrAgent };
