const express = require('express');

const TratamentoExternoController = require('../controllers/TratamentoExternoController');

const router = express.Router();

router.get('/tratamento-externo/saldos', TratamentoExternoController.getSaldos);
router.get('/tratamento-externo/movimentacoes', TratamentoExternoController.getMovimentacoes);

module.exports = router;
