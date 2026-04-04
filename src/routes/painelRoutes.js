const express = require('express');

const PainelController = require('../controllers/PainelController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ADMIN_READ_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/painel/resumo', requireApiRoles(ADMIN_READ_ROLES), PainelController.getSummary);

module.exports = router;
