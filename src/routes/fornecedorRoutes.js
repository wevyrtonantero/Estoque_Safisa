// Rotas do modulo de fornecedores.
const express = require('express');

const FornecedorController = require('../controllers/FornecedorController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, ADMIN_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

// Rota para listar fornecedores.
router.get('/fornecedores', requireApiRoles(STOCK_READ_ROLES), FornecedorController.getAll);

// Rota para autocomplete de fornecedores.
router.get('/fornecedores-autocomplete', requireApiRoles(STOCK_READ_ROLES), FornecedorController.getAutocomplete);

// Rota para buscar um fornecedor por ID.
router.get('/fornecedores/:id', requireApiRoles(STOCK_READ_ROLES), FornecedorController.getById);

// Rota para cadastrar fornecedor.
router.post('/fornecedores', requireApiRoles(ADMIN_WRITE_ROLES), FornecedorController.create);

// Rota para atualizar fornecedor.
router.put('/fornecedores/:id', requireApiRoles(ADMIN_WRITE_ROLES), FornecedorController.update);

// Rota para excluir fornecedor.
router.delete('/fornecedores/:id', requireApiRoles(ADMIN_DELETE_ROLES), FornecedorController.delete);

module.exports = router;
