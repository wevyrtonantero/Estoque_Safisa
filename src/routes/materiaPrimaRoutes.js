// Rotas do modulo de materias-primas.
const express = require('express');

const MateriaPrimaController = require('../controllers/MateriaPrimaController');
const MateriaPrimaFornecedorController = require('../controllers/MateriaPrimaFornecedorController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ALL_ROLES, ADMIN_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

// Rota para listar materias-primas.
router.get('/materias-primas', requireApiRoles(ALL_ROLES), MateriaPrimaController.getAll);

// Rota para autocomplete de materias-primas.
router.get('/materias-primas-autocomplete', requireApiRoles(ALL_ROLES), MateriaPrimaController.getAutocomplete);

// Rota para buscar materia-prima por ID.
router.get('/materias-primas/:id', requireApiRoles(ALL_ROLES), MateriaPrimaController.getById);

// Rota para listar fornecedores vinculados a materia-prima.
router.get('/materias-primas/:id/fornecedores', requireApiRoles(ALL_ROLES), MateriaPrimaFornecedorController.getAll);

// Rota para cadastrar materia-prima.
router.post('/materias-primas', requireApiRoles(ADMIN_WRITE_ROLES), MateriaPrimaController.create);

// Rota para vincular fornecedor a materia-prima.
router.post('/materias-primas/:id/fornecedores', requireApiRoles(ADMIN_WRITE_ROLES), MateriaPrimaFornecedorController.create);

// Rota para atualizar materia-prima.
router.put('/materias-primas/:id', requireApiRoles(ADMIN_WRITE_ROLES), MateriaPrimaController.update);

// Rota para atualizar um vinculo de fornecedor da materia-prima.
router.put(
  '/materias-primas/:id/fornecedores/:vinculoId',
  requireApiRoles(ADMIN_WRITE_ROLES),
  MateriaPrimaFornecedorController.update
);

// Rota para excluir materia-prima.
router.delete('/materias-primas/:id', requireApiRoles(ADMIN_DELETE_ROLES), MateriaPrimaController.delete);

// Rota para excluir um vinculo de fornecedor da materia-prima.
router.delete(
  '/materias-primas/:id/fornecedores/:vinculoId',
  requireApiRoles(ADMIN_DELETE_ROLES),
  MateriaPrimaFornecedorController.delete
);

module.exports = router;
