const express = require('express');

const SolicitacaoEstoqueController = require('../controllers/SolicitacaoEstoqueController');

const router = express.Router();

router.get('/solicitacoes-estoque', SolicitacaoEstoqueController.getAll);
router.get('/solicitacoes-estoque/:id', SolicitacaoEstoqueController.getById);
router.post('/solicitacoes-estoque', SolicitacaoEstoqueController.create);
router.post('/solicitacoes-estoque/:id/iniciar-separacao', SolicitacaoEstoqueController.startSeparation);
router.post('/solicitacoes-estoque/:id/atender', SolicitacaoEstoqueController.fulfill);
router.post('/solicitacoes-estoque/:id/cancelar', SolicitacaoEstoqueController.cancel);

module.exports = router;
