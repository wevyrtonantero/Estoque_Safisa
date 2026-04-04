const express = require('express');

const SolicitacaoProducaoController = require('../controllers/SolicitacaoProducaoController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES, OPERATION_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/solicitacoes-producao', requireApiRoles(OPERATION_READ_ROLES), SolicitacaoProducaoController.getAll);
router.get('/solicitacoes-producao/:id', requireApiRoles(OPERATION_READ_ROLES), SolicitacaoProducaoController.getById);
router.post('/solicitacoes-producao', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoProducaoController.create);
router.post('/solicitacoes-producao/:id/status', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoProducaoController.updateStatus);

module.exports = router;
