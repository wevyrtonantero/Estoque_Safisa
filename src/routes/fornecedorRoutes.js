// Rotas do modulo de fornecedores.
const express = require('express');

const FornecedorController = require('../controllers/FornecedorController');

const router = express.Router();

// Rota para listar fornecedores.
router.get('/fornecedores', FornecedorController.getAll);

// Rota para autocomplete de fornecedores.
router.get('/fornecedores-autocomplete', FornecedorController.getAutocomplete);

// Rota para buscar um fornecedor por ID.
router.get('/fornecedores/:id', FornecedorController.getById);

// Rota para cadastrar fornecedor.
router.post('/fornecedores', FornecedorController.create);

// Rota para atualizar fornecedor.
router.put('/fornecedores/:id', FornecedorController.update);

// Rota para excluir fornecedor.
router.delete('/fornecedores/:id', FornecedorController.delete);

module.exports = router;
