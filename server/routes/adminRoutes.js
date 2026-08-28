const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/analytics', adminController.getAnalytics);
router.post('/backup', adminController.createBackup);
router.get('/backups', adminController.getBackups);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/ai-inventory', adminController.getInventoryIntelligence);

module.exports = router;
