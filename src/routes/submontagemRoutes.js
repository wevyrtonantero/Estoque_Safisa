// Rotas da API para submontagens e sua estrutura de componentes.
const express = require('express');

const SubmontagemController = require('../controllers/SubmontagemController');
const EstruturaSubmontagemController = require('../controllers/EstruturaSubmontagemController');

const router = express.Router();

// Rota para listar submontagens.
router.get('/submontagens', SubmontagemController.getAll);

// Rota para buscar uma submontagem por ID.
router.get('/submontagens/:id', SubmontagemController.getById);

// Rota para simular montagem da submontagem em todos os estoques.
router.get('/submontagens/:id/simulacao', SubmontagemController.simulate);

// Rota para cadastrar submontagens.
router.post('/submontagens', SubmontagemController.create);

// Rota para atualizar submontagens.
router.put('/submontagens/:id', SubmontagemController.update);

// Rota para excluir submontagens.
router.delete('/submontagens/:id', SubmontagemController.delete);

// Rota para listar os componentes de uma submontagem.
router.get('/submontagens/:id/componentes', EstruturaSubmontagemController.getComponents);

// Rota para adicionar componente na estrutura.
router.post('/submontagens/:id/componentes', EstruturaSubmontagemController.createComponent);

// Rota para atualizar componente da estrutura.
router.put(
  '/submontagens/:id/componentes/:componenteId',
  EstruturaSubmontagemController.updateComponent
);

// Rota para remover componente da estrutura.
router.delete(
  '/submontagens/:id/componentes/:componenteId',
  EstruturaSubmontagemController.deleteComponent
);

module.exports = router;
