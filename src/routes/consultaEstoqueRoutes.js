const express = require('express');

const ConsultaEstoqueController = require('../controllers/ConsultaEstoqueController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/consulta-estoques/resumo', requireApiRoles(STOCK_READ_ROLES), ConsultaEstoqueController.getResumo);

module.exports = router;
