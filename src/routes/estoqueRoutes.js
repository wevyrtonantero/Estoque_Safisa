// Rotas do modulo de controle de estoque.
const express = require('express');

const EstoqueController = require('../controllers/EstoqueController');

const router = express.Router();

// Rota para listar os estoques padrao.
router.get('/estoques', EstoqueController.getStocks);

// Rota auxiliar para listar pecas e submontagens nos modais.
router.get('/estoque/itens', EstoqueController.getItems);

// Rota para listar os saldos com filtros dinamicos.
router.get('/estoque/saldos', EstoqueController.getSaldos);

// Rota opcional para buscar um saldo especifico.
router.get('/estoque/saldos/:id', EstoqueController.getSaldoById);

// Rota para registrar entrada inicial no estoque.
router.post('/estoque/entrada-inicial', EstoqueController.createEntradaInicial);

// Rota para transferir item entre estoques.
router.post('/estoque/transferencia', EstoqueController.createTransferencia);

// Rota para ajustar manualmente o saldo do estoque.
router.post('/estoque/ajuste', EstoqueController.createAjuste);

// Rota para registrar baixa de venda pela expedicao.
router.post('/estoque/saida', EstoqueController.createSaida);

// Rota para listar historico geral de movimentacoes.
router.get('/estoque/movimentacoes', EstoqueController.getMovimentacoes);

// Rota para listar historico de um item especifico.
router.get('/estoque/movimentacoes/:idPeca', EstoqueController.getMovimentacoesByPeca);

module.exports = router;
