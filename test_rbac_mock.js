const { User } = require('./models');
const { registerUser, loginUser } = require('./controllers/authController');
const { adminOnly, agentOnly, adminOrAgent } = require('./middleware/roleMiddleware');
const { checkAgentAccess } = require('./middleware/accessMiddleware');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Mock Express objects
const mockReq = (user, params = {}, body = {}) => ({
    user,
    params,
    body,
    headers: {}
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const mockNext = () => {
    mockNext.called = true;
};

async function runTests() {
    console.log('--- Starting RBAC Verification ---');

    try {
        // 1. Setup Test Users
        console.log('Creating test users...');
        const adminUser = { id: 1, username: 'admin', role: 'admin' };
        const agentA = { id: 2, username: 'agentA', role: 'agent' };
        const agentB = { id: 3, username: 'agentB', role: 'agent' };
        const userA = { id: 4, username: 'userA', role: 'user', agentId: 2 };
        const userB = { id: 5, username: 'userB', role: 'user', agentId: 3 };

        // 2. Test Middleware Logic Directly
        console.log('\n--- Testing Role Middleware ---');

        // Admin Only
        let req = mockReq(adminUser);
        let res = mockRes();
        mockNext.called = false;
        adminOnly(req, res, mockNext);
        console.log(`Admin accessing adminOnly: ${mockNext.called ? 'PASS' : 'FAIL'}`);

        req = mockReq(agentA);
        res = mockRes();
        mockNext.called = false;
        adminOnly(req, res, mockNext);
        console.log(`Agent accessing adminOnly: ${!mockNext.called && res.statusCode === 403 ? 'PASS' : 'FAIL'}`);

        // Agent Only
        req = mockReq(agentA);
        res = mockRes();
        mockNext.called = false;
        agentOnly(req, res, mockNext);
        console.log(`Agent accessing agentOnly: ${mockNext.called ? 'PASS' : 'FAIL'}`);

        req = mockReq(userA);
        res = mockRes();
        mockNext.called = false;
        agentOnly(req, res, mockNext);
        console.log(`User accessing agentOnly: ${!mockNext.called && res.statusCode === 403 ? 'PASS' : 'FAIL'}`);

        // 3. Test Hierarchical Access (checkAgentAccess)
        console.log('\n--- Testing Hierarchical Access ---');

        // Mock database findByPk specifically for this test
        const originalFindByPk = User.findByPk;
        User.findByPk = async (id) => {
            if (id === 4) return userA;
            if (id === 5) return userB;
            return null;
        };

        // Agent A accessing User A
        req = mockReq(agentA, { id: 4 });
        res = mockRes();
        mockNext.called = false;
        await checkAgentAccess(req, res, mockNext);
        console.log(`Agent A accessing User A: ${mockNext.called && req.targetUser && req.targetUser.id === 4 ? 'PASS' : 'FAIL'}`);

        // Agent A accessing User B
        req = mockReq(agentA, { id: 5 });
        res = mockRes();
        mockNext.called = false;
        await checkAgentAccess(req, res, mockNext);
        console.log(`Agent A accessing User B: ${!mockNext.called && res.statusCode === 403 ? 'PASS' : 'FAIL'}`);

        // Admin accessing User B
        req = mockReq(adminUser, { id: 5 });
        res = mockRes();
        mockNext.called = false;
        await checkAgentAccess(req, res, mockNext);
        console.log(`Admin accessing User B: ${mockNext.called && req.targetUser && req.targetUser.id === 5 ? 'PASS' : 'FAIL'}`);

        // Agent accessing valid User via body
        req = mockReq(agentA, {}, { userId: 4 });
        res = mockRes();
        mockNext.called = false;
        await checkAgentAccess(req, res, mockNext);
        console.log(`Agent A accessing User A (via body): ${mockNext.called && req.targetUser && req.targetUser.id === 4 ? 'PASS' : 'FAIL'}`);

        // Restore Mock
        User.findByPk = originalFindByPk;

        console.log('\n--- Verification Complete ---');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests();
