const express = require('express');
const router = express.Router();
const {
	getUsers,
	getAgents,
	suspendUser,
	unsuspendUser,
	getStats,
	getSystemStats,
	getAdminHeaderSummary,
	createAgent,
	createUser,
	updateAgent,
	updateUserCredit,
	refreshOdds,
	getWeeklyFigures,
	getPendingTransactions,
	approvePendingTransaction,
	declinePendingTransaction,
	getMessages,
	markMessageRead,
	replyToMessage,
	deleteMessage,
	getAdminMatches,
	createMatch,
	updateMatch,
	getCashierSummary,
	getCashierTransactions,
	getThirdPartyLimits,
	createThirdPartyLimit,
	updateThirdPartyLimit,
	getAdminBets,
	createAdminBet,
	deleteAdminBet,
	getAgentPerformance,
	getAgentPerformanceDetails,
	getIpTracker,
	blockIp,
	unblockIp,
	getTransactionsHistory,
	getCollections,
	createCollection,
	collectCollection,
	getCollectionById,
	getDeletedWagers,
	restoreDeletedWager,
	getSportsbookLinks,
	createSportsbookLink,
	updateSportsbookLink,
	testSportsbookLink,
	clearCache,
	getBillingSummary,
	getBillingInvoices,
	createBillingInvoice,
	updateBillingInvoice,
	getBillingInvoiceById,
	getSettings,
	updateSettings,
	getRules,
	createRule,
	updateRule,
	deleteRule,
	getBetModeRules,
	updateBetModeRule,
	getFeedback,
	replyFeedback,
	markFeedbackReviewed,
	deleteFeedback,
	getFaqs,
	createFaq,
	updateFaq,
	deleteFaq,
	getManualSections,
	createManualSection,
	updateManualSection,
	deleteManualSection,
	getUserStats,
	getNextUsername,
	updateUser,
	resetUserPassword,
	resetAgentPassword,
	impersonateUser,
	fetchOddsManual,
	updateUserFreeplay,
	whitelistIp,
	getAgentTree,
	deleteUser,
	deleteAgent
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, adminOrAgent } = require('../middleware/roleMiddleware');
const rateLimit = require('../middleware/rateLimit');


const adminRefreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1 });
const manualFetchLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 1 });

router.get('/users', protect, adminOrAgent, getUsers);
router.get('/agents', protect, adminOnly, getAgents);
router.post('/create-agent', protect, adminOnly, createAgent);
router.put('/agent/:id', protect, adminOnly, updateAgent); // New Route
router.post('/create-user', protect, adminOrAgent, createUser);
router.post('/suspend', protect, adminOrAgent, suspendUser);
router.post('/unsuspend', protect, adminOrAgent, unsuspendUser);
router.put('/users/:id/credit', protect, adminOrAgent, updateUserCredit);
router.put('/users/:id', protect, adminOnly, updateUser);
router.get('/stats', protect, adminOrAgent, getStats);
router.get('/system-stats', protect, adminOrAgent, getSystemStats);
router.get('/header-summary', protect, adminOrAgent, getAdminHeaderSummary);
router.post('/refresh-odds', protect, adminOnly, adminRefreshLimiter, refreshOdds); // New Route
router.post('/fetch-odds', protect, adminOnly, manualFetchLimiter, fetchOddsManual);
router.get('/weekly-figures', protect, adminOrAgent, getWeeklyFigures);
router.get('/pending', protect, adminOrAgent, getPendingTransactions);
router.post('/pending/approve', protect, adminOrAgent, approvePendingTransaction);
router.post('/pending/decline', protect, adminOrAgent, declinePendingTransaction);
router.get('/messages', protect, adminOnly, getMessages);
router.post('/messages/:id/read', protect, adminOnly, markMessageRead);
router.post('/messages/:id/reply', protect, adminOnly, replyToMessage);
router.delete('/messages/:id', protect, adminOnly, deleteMessage);
router.get('/matches', protect, adminOnly, getAdminMatches);
router.post('/matches', protect, adminOnly, createMatch);
router.put('/matches/:id', protect, adminOnly, updateMatch);
router.get('/cashier/summary', protect, adminOnly, getCashierSummary);
router.get('/cashier/transactions', protect, adminOnly, getCashierTransactions);
router.get('/third-party-limits', protect, adminOnly, getThirdPartyLimits);
router.post('/third-party-limits', protect, adminOnly, createThirdPartyLimit);
router.put('/third-party-limits/:id', protect, adminOnly, updateThirdPartyLimit);
router.get('/bets', protect, adminOrAgent, getAdminBets);
router.post('/bets', protect, adminOrAgent, createAdminBet);
router.delete('/bets/:id', protect, adminOrAgent, deleteAdminBet);
router.get('/agent-performance', protect, adminOrAgent, getAgentPerformance);
router.get('/agent-performance/:id/details', protect, adminOrAgent, getAgentPerformanceDetails);
router.get('/ip-tracker', protect, adminOrAgent, getIpTracker);
router.post('/ip-tracker/:id/block', protect, adminOrAgent, blockIp);
router.post('/ip-tracker/:id/unblock', protect, adminOrAgent, unblockIp);
router.post('/ip-tracker/:id/whitelist', protect, adminOrAgent, whitelistIp);
router.get('/transactions', protect, adminOnly, getTransactionsHistory);
router.get('/collections', protect, adminOnly, getCollections);
router.post('/collections', protect, adminOnly, createCollection);
router.post('/collections/:id/collect', protect, adminOnly, collectCollection);
router.get('/collections/:id', protect, adminOnly, getCollectionById);
router.get('/deleted-wagers', protect, adminOnly, getDeletedWagers);
router.post('/deleted-wagers/:id/restore', protect, adminOnly, restoreDeletedWager);
router.get('/sportsbook-links', protect, adminOnly, getSportsbookLinks);
router.post('/sportsbook-links', protect, adminOnly, createSportsbookLink);
router.put('/sportsbook-links/:id', protect, adminOnly, updateSportsbookLink);
router.post('/sportsbook-links/:id/test', protect, adminOnly, testSportsbookLink);
router.post('/clear-cache', protect, adminOnly, clearCache);
router.get('/billing/summary', protect, adminOnly, getBillingSummary);
router.get('/billing/invoices', protect, adminOnly, getBillingInvoices);
router.post('/billing/invoices', protect, adminOnly, createBillingInvoice);
router.put('/billing/invoices/:id', protect, adminOnly, updateBillingInvoice);
router.get('/billing/invoices/:id', protect, adminOnly, getBillingInvoiceById);
router.get('/settings', protect, adminOnly, getSettings);
router.put('/settings', protect, adminOnly, updateSettings);
router.get('/rules', protect, adminOnly, getRules);
router.post('/rules', protect, adminOnly, createRule);
router.put('/rules/:id', protect, adminOnly, updateRule);
router.delete('/rules/:id', protect, adminOnly, deleteRule);
router.get('/bet-mode-rules', protect, adminOnly, getBetModeRules);
router.put('/bet-mode-rules/:mode', protect, adminOnly, updateBetModeRule);
router.get('/feedback', protect, adminOnly, getFeedback);
router.post('/feedback/:id/reply', protect, adminOnly, replyFeedback);
router.post('/feedback/:id/reviewed', protect, adminOnly, markFeedbackReviewed);
router.delete('/feedback/:id', protect, adminOnly, deleteFeedback);
router.get('/faqs', protect, adminOnly, getFaqs);
router.post('/faqs', protect, adminOnly, createFaq);
router.put('/faqs/:id', protect, adminOnly, updateFaq);
router.delete('/faqs/:id', protect, adminOnly, deleteFaq);
router.get('/manual', protect, adminOnly, getManualSections);
router.post('/manual', protect, adminOnly, createManualSection);
router.put('/manual/:id', protect, adminOnly, updateManualSection);
router.delete('/manual/:id', protect, adminOnly, deleteManualSection);

// Password Reset Routes
router.post('/users/:id/reset-password', protect, adminOrAgent, resetUserPassword);
router.put('/users/:id/freeplay', protect, adminOrAgent, updateUserFreeplay);
router.post('/agents/:id/reset-password', protect, adminOnly, resetAgentPassword);

// User Statistics Route
router.get('/users/:userId/stats', protect, adminOrAgent, getUserStats);

router.get('/next-username/:prefix', protect, adminOrAgent, getNextUsername);

// Impersonation Route
router.post('/impersonate-user/:id', protect, adminOrAgent, impersonateUser);

// Agent Tree Route
router.get('/agent-tree', protect, adminOrAgent, getAgentTree);

// Delete Routes (Admin Only)
router.delete('/users/:id', protect, adminOnly, deleteUser);
router.delete('/agents/:id', protect, adminOnly, deleteAgent);

module.exports = router;
