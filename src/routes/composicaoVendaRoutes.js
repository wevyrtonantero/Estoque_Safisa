const express = require('express');

const ComposicaoVendaController = require('../controllers/ComposicaoVendaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, ADMIN_WRITE_ROLES, ADMIN_DELETE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/composicoes-venda', requireApiRoles(STOCK_READ_ROLES), ComposicaoVendaController.getAll);
router.get('/composicoes-venda/:idItemVenda', requireApiRoles(STOCK_READ_ROLES), ComposicaoVendaController.getByItemVenda);
router.post('/composicoes-venda', requireApiRoles(ADMIN_WRITE_ROLES), ComposicaoVendaController.create);
router.put('/composicoes-venda/:id', requireApiRoles(ADMIN_WRITE_ROLES), ComposicaoVendaController.update);
router.delete('/composicoes-venda/:id', requireApiRoles(ADMIN_DELETE_ROLES), ComposicaoVendaController.delete);

module.exports = router;
