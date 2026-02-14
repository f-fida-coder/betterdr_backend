const express = require('express');
const router = express.Router();
const { createUser, getMyUsers, getAgentStats, updateUserBalanceOwed, updateCustomer, createSubAgent, getMySubAgents } = require('../controllers/agentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes here are protected and for agents/super-agents
router.use(protect);
router.use(authorize('agent', 'super_agent', 'admin'));

const ensureAgentNotViewOnly = (req, res, next) => {
	if (req.user.role !== 'agent' && req.user.role !== 'super_agent') return next();
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

// Super Agent specialized routes
router.post('/create-sub-agent', authorize('super_agent'), ensureAgentNotViewOnly, createSubAgent);
router.get('/my-sub-agents', authorize('super_agent', 'admin'), getMySubAgents);

module.exports = router;
