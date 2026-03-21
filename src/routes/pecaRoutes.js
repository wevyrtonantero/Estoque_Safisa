// Rotas da API para pecas simples e endpoint auxiliar de itens.
const express = require('express');

const PecaController = require('../controllers/PecaController');
const PecaFornecedorController = require('../controllers/PecaFornecedorController');

const router = express.Router();

// Rota para listar pecas.
router.get('/pecas', PecaController.getAll);

// Rota para listar itens simples para o select da estrutura.
router.get('/itens-simples', PecaController.getSimpleItems);

// Rota para buscar uma peca pelo ID.
router.get('/pecas/:id', PecaController.getById);

// Rota para localizar onde a peca esta vinculada em submontagens.
router.get('/pecas/:id/submontagens', PecaController.getSubmontagemUsages);

// Estrutura preparada porque uma peca pode ter mais de um fornecedor.
router.get('/pecas/:id/fornecedores', PecaFornecedorController.getAll);

// Rota para cadastrar pecas.
router.post('/pecas', PecaController.create);

// Estrutura preparada para criar vinculos de fornecedor da peca.
router.post('/pecas/:id/fornecedores', PecaFornecedorController.create);

// Rota para atualizar pecas.
router.put('/pecas/:id', PecaController.update);

// Estrutura preparada para atualizar vinculos de fornecedor da peca.
router.put('/pecas/:id/fornecedores/:vinculoId', PecaFornecedorController.update);

// Rota para excluir pecas.
router.delete('/pecas/:id', PecaController.delete);

// Estrutura preparada para excluir vinculos de fornecedor da peca.
router.delete('/pecas/:id/fornecedores/:vinculoId', PecaFornecedorController.delete);

module.exports = router;
