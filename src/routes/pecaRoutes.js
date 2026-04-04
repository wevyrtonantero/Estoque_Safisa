// Rotas da API para pecas simples e endpoint auxiliar de itens.
const express = require('express');

const PecaController = require('../controllers/PecaController');
const PecaFornecedorController = require('../controllers/PecaFornecedorController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ALL_ROLES, ADMIN_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

// Rota para listar pecas.
router.get('/pecas', requireApiRoles(ALL_ROLES), PecaController.getAll);

// Rota para listar itens simples para o select da estrutura.
router.get('/itens-simples', requireApiRoles(ALL_ROLES), PecaController.getSimpleItems);

// Rota para buscar uma peca pelo ID.
router.get('/pecas/:id', requireApiRoles(ALL_ROLES), PecaController.getById);

// Rota para localizar onde a peca esta vinculada em submontagens.
router.get('/pecas/:id/submontagens', requireApiRoles(ALL_ROLES), PecaController.getSubmontagemUsages);

// Estrutura preparada porque uma peca pode ter mais de um fornecedor.
router.get('/pecas/:id/fornecedores', requireApiRoles(ALL_ROLES), PecaFornecedorController.getAll);

// Rota para cadastrar pecas.
router.post('/pecas', requireApiRoles(ADMIN_WRITE_ROLES), PecaController.create);

// Estrutura preparada para criar vinculos de fornecedor da peca.
router.post('/pecas/:id/fornecedores', requireApiRoles(ADMIN_WRITE_ROLES), PecaFornecedorController.create);

// Rota para atualizar pecas.
router.put('/pecas/:id', requireApiRoles(ADMIN_WRITE_ROLES), PecaController.update);

// Estrutura preparada para atualizar vinculos de fornecedor da peca.
router.put('/pecas/:id/fornecedores/:vinculoId', requireApiRoles(ADMIN_WRITE_ROLES), PecaFornecedorController.update);

// Rota para excluir pecas.
router.delete('/pecas/:id', requireApiRoles(ADMIN_DELETE_ROLES), PecaController.delete);

// Estrutura preparada para excluir vinculos de fornecedor da peca.
router.delete('/pecas/:id/fornecedores/:vinculoId', requireApiRoles(ADMIN_DELETE_ROLES), PecaFornecedorController.delete);

module.exports = router;
