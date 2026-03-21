// Rotas do modulo de maquinas.
const express = require('express');

const MaquinaController = require('../controllers/MaquinaController');

const router = express.Router();

// Rota para listar maquinas.
router.get('/maquinas', MaquinaController.getAll);

// Rota para autocomplete de maquinas.
router.get('/maquinas-autocomplete', MaquinaController.getAutocomplete);

// Rota para buscar maquina por ID.
router.get('/maquinas/:id', MaquinaController.getById);

// Rota para cadastrar maquina.
router.post('/maquinas', MaquinaController.create);

// Rota para atualizar maquina.
router.put('/maquinas/:id', MaquinaController.update);

// Rota para excluir maquina.
router.delete('/maquinas/:id', MaquinaController.delete);

module.exports = router;
