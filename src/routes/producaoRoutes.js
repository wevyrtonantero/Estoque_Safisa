const express = require('express');

const ProducaoController = require('../controllers/ProducaoController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, OPERATION_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/producao', requireApiRoles(STOCK_READ_ROLES), ProducaoController.getAll);
router.get('/producao/:id', requireApiRoles(STOCK_READ_ROLES), ProducaoController.getById);
router.post('/producao', requireApiRoles(OPERATION_WRITE_ROLES), ProducaoController.create);
router.post('/producao/:id/finalizar', requireApiRoles(OPERATION_WRITE_ROLES), ProducaoController.finish);
router.delete('/producao/:id', requireApiRoles(ADMIN_DELETE_ROLES), ProducaoController.delete);

module.exports = router;
