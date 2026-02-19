const express = require('express');
const router = express.Router();
const { createUser, getMyUsers, getAgentStats, updateUserBalanceOwed, updateCustomer, createSubAgent, getMySubAgents } = require('../controllers/agentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes here are protected and for agents/super-agents
router.use(protect);
router.use(authorize('agent', 'master_agent', 'admin', 'super_agent'));

const ensureAgentNotViewOnly = (req, res, next) => {
	if (req.user.role !== 'agent' && req.user.role !== 'master_agent' && req.user.role !== 'super_agent') return next();
	if (req.user.viewOnly || req.user.agentBillingStatus === 'unpaid') {
		return res.status(403).json({ message: 'Account is view-only due to unpaid platform balance.' });
	}
	return next();
};

router.post('/create-user', ensureAgentNotViewOnly, createUser);
router.get('/my-users', getMyUsers);
router.get('/stats', getAgentStats);
router.post('/update-balance-owed', ensureAgentNotViewOnly, updateUserBalanceOwed);
router.put('/users/:id', ensureAgentNotViewOnly, updateCustomer);

// Permissions Management
router.put('/permissions/:id', authorize('admin', 'master_agent', 'super_agent'), (req, res, next) => {
	const { updateAgentPermissions } = require('../controllers/adminController');
	updateAgentPermissions(req, res, next);
});

// Master Agent specialized routes
router.post('/create-sub-agent', authorize('master_agent', 'super_agent'), ensureAgentNotViewOnly, createSubAgent);
router.get('/my-sub-agents', authorize('master_agent', 'admin', 'super_agent'), getMySubAgents);

module.exports = router;
