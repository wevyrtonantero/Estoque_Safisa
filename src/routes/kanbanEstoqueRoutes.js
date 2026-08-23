const express = require('express');
const KanbanEstoqueController = require('../controllers/KanbanEstoqueController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, STOCK_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/kanban-estoque', requireApiRoles(STOCK_READ_ROLES), KanbanEstoqueController.list);
router.get('/kanban-estoque/pecas', requireApiRoles(STOCK_READ_ROLES), KanbanEstoqueController.listPieces);
router.get('/kanban-estoque/faltas-expedicao', requireApiRoles(STOCK_READ_ROLES), KanbanEstoqueController.listExpeditionShortages);
router.post('/kanban-estoque/categorias', requireApiRoles(STOCK_WRITE_ROLES), KanbanEstoqueController.createCategory);
router.put('/kanban-estoque/categorias/:id', requireApiRoles(STOCK_WRITE_ROLES), KanbanEstoqueController.updateCategory);
router.delete('/kanban-estoque/categorias/:id', requireApiRoles(STOCK_WRITE_ROLES), KanbanEstoqueController.deleteCategory);
router.post('/kanban-estoque/itens', requireApiRoles(STOCK_WRITE_ROLES), KanbanEstoqueController.createItem);
router.put('/kanban-estoque/itens/:id', requireApiRoles(STOCK_WRITE_ROLES), KanbanEstoqueController.updateItem);
router.delete('/kanban-estoque/itens/:id', requireApiRoles(STOCK_WRITE_ROLES), KanbanEstoqueController.deleteItem);

module.exports = router;
