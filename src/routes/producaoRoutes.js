const express = require('express');

const ProducaoController = require('../controllers/ProducaoController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, OPERATION_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/producao', requireApiRoles(STOCK_READ_ROLES), ProducaoController.getAll);
router.get('/producao/:id', requireApiRoles(STOCK_READ_ROLES), ProducaoController.getById);
router.get('/producao/:id/destinos', requireApiRoles(STOCK_READ_ROLES), ProducaoController.getDestinations);
router.post('/producao', requireApiRoles(OPERATION_WRITE_ROLES), ProducaoController.create);
router.post('/producao/:id/finalizar', requireApiRoles(OPERATION_WRITE_ROLES), ProducaoController.finish);
router.post('/producao/:id/destinos', requireApiRoles(OPERATION_WRITE_ROLES), ProducaoController.allocateDestination);
router.delete('/producao/:id', requireApiRoles(ADMIN_DELETE_ROLES), ProducaoController.delete);

module.exports = router;
