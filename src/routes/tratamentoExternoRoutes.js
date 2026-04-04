const express = require('express');

const TratamentoExternoController = require('../controllers/TratamentoExternoController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES, OPERATION_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/tratamento-externo/saldos', requireApiRoles(OPERATION_READ_ROLES), TratamentoExternoController.getSaldos);
router.get('/tratamento-externo/movimentacoes', requireApiRoles(OPERATION_READ_ROLES), TratamentoExternoController.getMovimentacoes);
router.post('/tratamento-externo/enviar-estoque', requireApiRoles(OPERATION_WRITE_ROLES), TratamentoExternoController.sendToStock);

module.exports = router;
