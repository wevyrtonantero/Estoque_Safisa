const express = require('express');

const EstoqueMateriaPrimaController = require('../controllers/EstoqueMateriaPrimaController');

const router = express.Router();

router.get('/estoque-materias-primas/saldos', EstoqueMateriaPrimaController.getSaldos);
router.get('/estoque-materias-primas/movimentacoes', EstoqueMateriaPrimaController.getMovimentacoes);
router.post('/estoque-materias-primas/entrada', EstoqueMateriaPrimaController.createEntrada);
router.post('/estoque-materias-primas/ajuste', EstoqueMateriaPrimaController.createAjuste);

module.exports = router;
