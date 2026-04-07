const express = require('express');

const ComposicaoVendaController = require('../controllers/ComposicaoVendaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/composicoes-venda', requireApiRoles(STOCK_READ_ROLES), ComposicaoVendaController.getAll);
router.get('/composicoes-venda/:idItemVenda', requireApiRoles(STOCK_READ_ROLES), ComposicaoVendaController.getByItemVenda);

module.exports = router;
