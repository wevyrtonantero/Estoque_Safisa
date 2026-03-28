const express = require('express');

const SolicitacaoProducaoController = require('../controllers/SolicitacaoProducaoController');

const router = express.Router();

router.get('/solicitacoes-producao', SolicitacaoProducaoController.getAll);
router.get('/solicitacoes-producao/:id', SolicitacaoProducaoController.getById);
router.post('/solicitacoes-producao', SolicitacaoProducaoController.create);
router.post('/solicitacoes-producao/:id/status', SolicitacaoProducaoController.updateStatus);

module.exports = router;
