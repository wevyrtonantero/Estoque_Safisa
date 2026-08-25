// Rotas do modulo de controle de estoque.
const express = require('express');

const EstoqueController = require('../controllers/EstoqueController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, STOCK_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

// Rota para listar os estoques padrao.
router.get('/estoques', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getStocks);

// Rota auxiliar para listar pecas e submontagens nos modais.
router.get('/estoque/itens', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getItems);

// Rota para listar os saldos com filtros dinamicos.
router.get('/estoque/saldos', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getSaldos);

// Rota para listar prioridades de reposicao/producao por estoque.
router.get('/estoque/prioridades', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getPrioridades);

// Rota opcional para buscar um saldo especifico.
router.get('/estoque/saldos/:id', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getSaldoById);

// Rota para registrar entrada inicial no estoque.
router.post('/estoque/entrada-inicial', requireApiRoles(STOCK_WRITE_ROLES), EstoqueController.createEntradaInicial);
router.post('/estoque/entrada-inicial-lote', requireApiRoles(STOCK_WRITE_ROLES), EstoqueController.createEntradaInicialBatch);

// Rota para transferir item entre estoques.
router.post('/estoque/transferencia', requireApiRoles(STOCK_WRITE_ROLES), EstoqueController.createTransferencia);

// Rota para ajustar manualmente o saldo do estoque.
router.post('/estoque/ajuste', requireApiRoles(STOCK_WRITE_ROLES), EstoqueController.createAjuste);

// Rota para registrar saida final pela expedicao.
router.post('/estoque/saida', requireApiRoles(STOCK_WRITE_ROLES), EstoqueController.createSaida);

// Rota para simular uma saida sem alterar o estoque.
router.post('/estoque/saida/diagnostico', requireApiRoles(STOCK_READ_ROLES), EstoqueController.diagnosticarSaida);

// Rota para registrar consumo interno do Almoxarifado.
router.post('/estoque/consumo-interno', requireApiRoles(STOCK_WRITE_ROLES), EstoqueController.createConsumoInterno);

// Rota para listar o relatorio estruturado de saidas da expedicao.
router.get('/expedicao/saidas', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getSaidasExpedicao);

// Rota para listar historico geral de movimentacoes.
router.get('/estoque/movimentacoes', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getMovimentacoes);

// Rota para listar historico de um item especifico.
router.get('/estoque/movimentacoes/:idPeca', requireApiRoles(STOCK_READ_ROLES), EstoqueController.getMovimentacoesByPeca);

module.exports = router;
