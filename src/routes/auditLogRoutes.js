const express = require('express');

const AuditLogController = require('../controllers/AuditLogController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ADMIN_READ_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/auditoria-logs', requireApiRoles(ADMIN_READ_ROLES), AuditLogController.getAll);
router.get('/auditoria-logs/:id', requireApiRoles(ADMIN_READ_ROLES), AuditLogController.getById);

module.exports = router;
