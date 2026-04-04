// Rotas da API para submontagens e sua estrutura de componentes.
const express = require('express');

const SubmontagemController = require('../controllers/SubmontagemController');
const EstruturaSubmontagemController = require('../controllers/EstruturaSubmontagemController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ALL_ROLES, ADMIN_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

// Rota para listar submontagens.
router.get('/submontagens', requireApiRoles(ALL_ROLES), SubmontagemController.getAll);

// Rota para buscar uma submontagem por ID.
router.get('/submontagens/:id', requireApiRoles(ALL_ROLES), SubmontagemController.getById);

// Rota para simular montagem da submontagem em todos os estoques.
router.get('/submontagens/:id/simulacao', requireApiRoles(ALL_ROLES), SubmontagemController.simulate);

// Rota para cadastrar submontagens.
router.post('/submontagens', requireApiRoles(ADMIN_WRITE_ROLES), SubmontagemController.create);

// Rota para atualizar submontagens.
router.put('/submontagens/:id', requireApiRoles(ADMIN_WRITE_ROLES), SubmontagemController.update);

// Rota para excluir submontagens.
router.delete('/submontagens/:id', requireApiRoles(ADMIN_DELETE_ROLES), SubmontagemController.delete);

// Rota para listar os componentes de uma submontagem.
router.get('/submontagens/:id/componentes', requireApiRoles(ALL_ROLES), EstruturaSubmontagemController.getComponents);

// Rota para adicionar componente na estrutura.
router.post('/submontagens/:id/componentes', requireApiRoles(ADMIN_WRITE_ROLES), EstruturaSubmontagemController.createComponent);

// Rota para atualizar componente da estrutura.
router.put(
  '/submontagens/:id/componentes/:componenteId',
  requireApiRoles(ADMIN_WRITE_ROLES),
  EstruturaSubmontagemController.updateComponent
);

// Rota para remover componente da estrutura.
router.delete(
  '/submontagens/:id/componentes/:componenteId',
  requireApiRoles(ADMIN_DELETE_ROLES),
  EstruturaSubmontagemController.deleteComponent
);

module.exports = router;
