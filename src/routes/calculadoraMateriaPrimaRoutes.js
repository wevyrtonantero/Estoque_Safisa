const express = require('express');

const CalculadoraMateriaPrimaController = require('../controllers/CalculadoraMateriaPrimaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { STOCK_READ_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/calculadora-materia-prima/pecas', requireApiRoles(STOCK_READ_ROLES), CalculadoraMateriaPrimaController.getPecas);
router.post('/calculadora-materia-prima/simular', requireApiRoles(STOCK_READ_ROLES), CalculadoraMateriaPrimaController.simulate);

module.exports = router;
