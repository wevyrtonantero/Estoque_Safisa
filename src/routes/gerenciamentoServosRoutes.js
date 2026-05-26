const express = require('express');

const GerenciamentoServosController = require('../controllers/GerenciamentoServosController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/gerenciamento-servos/matriz', requireApiRoles(OPERATION_READ_ROLES), GerenciamentoServosController.getMatrix);

module.exports = router;
