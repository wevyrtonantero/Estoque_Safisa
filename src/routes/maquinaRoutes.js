// Rotas do modulo de maquinas.
const express = require('express');

const MaquinaController = require('../controllers/MaquinaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ALL_ROLES, ADMIN_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

// Rota para listar maquinas.
router.get('/maquinas', requireApiRoles(ALL_ROLES), MaquinaController.getAll);

// Rota para autocomplete de maquinas.
router.get('/maquinas-autocomplete', requireApiRoles(ALL_ROLES), MaquinaController.getAutocomplete);

// Rota para buscar maquina por ID.
router.get('/maquinas/:id', requireApiRoles(ALL_ROLES), MaquinaController.getById);

// Rota para cadastrar maquina.
router.post('/maquinas', requireApiRoles(ADMIN_WRITE_ROLES), MaquinaController.create);

// Rota para atualizar maquina.
router.put('/maquinas/:id', requireApiRoles(ADMIN_WRITE_ROLES), MaquinaController.update);

// Rota para excluir maquina.
router.delete('/maquinas/:id', requireApiRoles(ADMIN_DELETE_ROLES), MaquinaController.delete);

module.exports = router;
