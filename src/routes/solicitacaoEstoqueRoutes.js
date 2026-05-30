const express = require('express');

const SolicitacaoEstoqueController = require('../controllers/SolicitacaoEstoqueController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES, OPERATION_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/solicitacoes-estoque', requireApiRoles(OPERATION_READ_ROLES), SolicitacaoEstoqueController.getAll);
router.post('/solicitacoes-estoque/notificar-resumo', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoEstoqueController.notifyResumo);
router.get('/solicitacoes-estoque/:id', requireApiRoles(OPERATION_READ_ROLES), SolicitacaoEstoqueController.getById);
router.post('/solicitacoes-estoque', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoEstoqueController.create);
router.post('/solicitacoes-estoque/:id/iniciar-separacao', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoEstoqueController.startSeparation);
router.post('/solicitacoes-estoque/:id/status', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoEstoqueController.updateStatus);
router.post('/solicitacoes-estoque/:id/atender', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoEstoqueController.fulfill);
router.post('/solicitacoes-estoque/:id/cancelar', requireApiRoles(OPERATION_WRITE_ROLES), SolicitacaoEstoqueController.cancel);

module.exports = router;
