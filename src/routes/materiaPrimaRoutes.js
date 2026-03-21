// Rotas do modulo de materias-primas.
const express = require('express');

const MateriaPrimaController = require('../controllers/MateriaPrimaController');
const MateriaPrimaFornecedorController = require('../controllers/MateriaPrimaFornecedorController');

const router = express.Router();

// Rota para listar materias-primas.
router.get('/materias-primas', MateriaPrimaController.getAll);

// Rota para autocomplete de materias-primas.
router.get('/materias-primas-autocomplete', MateriaPrimaController.getAutocomplete);

// Rota para buscar materia-prima por ID.
router.get('/materias-primas/:id', MateriaPrimaController.getById);

// Rota para listar fornecedores vinculados a materia-prima.
router.get('/materias-primas/:id/fornecedores', MateriaPrimaFornecedorController.getAll);

// Rota para cadastrar materia-prima.
router.post('/materias-primas', MateriaPrimaController.create);

// Rota para vincular fornecedor a materia-prima.
router.post('/materias-primas/:id/fornecedores', MateriaPrimaFornecedorController.create);

// Rota para atualizar materia-prima.
router.put('/materias-primas/:id', MateriaPrimaController.update);

// Rota para atualizar um vinculo de fornecedor da materia-prima.
router.put(
  '/materias-primas/:id/fornecedores/:vinculoId',
  MateriaPrimaFornecedorController.update
);

// Rota para excluir materia-prima.
router.delete('/materias-primas/:id', MateriaPrimaController.delete);

// Rota para excluir um vinculo de fornecedor da materia-prima.
router.delete(
  '/materias-primas/:id/fornecedores/:vinculoId',
  MateriaPrimaFornecedorController.delete
);

module.exports = router;
