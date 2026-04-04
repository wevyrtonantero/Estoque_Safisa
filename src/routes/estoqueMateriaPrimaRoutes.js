const express = require('express');

const EstoqueMateriaPrimaController = require('../controllers/EstoqueMateriaPrimaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES, STOCK_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/estoque-materias-primas/saldos', requireApiRoles(STOCK_READ_ROLES), EstoqueMateriaPrimaController.getSaldos);
router.get('/estoque-materias-primas/saldos/:id_materia_prima', requireApiRoles(STOCK_READ_ROLES), EstoqueMateriaPrimaController.getSaldoByMateriaPrimaId);
router.get('/estoque-materias-primas/movimentacoes', requireApiRoles(STOCK_READ_ROLES), EstoqueMateriaPrimaController.getMovimentacoes);
router.post('/estoque-materias-primas/entrada', requireApiRoles(STOCK_WRITE_ROLES), EstoqueMateriaPrimaController.createEntrada);
router.post('/estoque-materias-primas/ajuste', requireApiRoles(STOCK_WRITE_ROLES), EstoqueMateriaPrimaController.createAjuste);

module.exports = router;
