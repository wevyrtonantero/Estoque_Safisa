const express = require('express');

const SubmontagemSerialController = require('../controllers/SubmontagemSerialController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES, OPERATION_WRITE_ROLES, ADMIN_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/submontagem-seriais/proximo', requireApiRoles(OPERATION_READ_ROLES), SubmontagemSerialController.getNextSerial);
router.get('/submontagem-seriais/disponiveis/resumo', requireApiRoles(OPERATION_READ_ROLES), SubmontagemSerialController.getAvailableSummary);
router.get('/submontagem-seriais/disponiveis', requireApiRoles(OPERATION_READ_ROLES), SubmontagemSerialController.getAvailable);
router.get('/submontagem-seriais', requireApiRoles(OPERATION_READ_ROLES), SubmontagemSerialController.getAll);
router.patch('/submontagem-seriais/sequencia', requireApiRoles(OPERATION_WRITE_ROLES), SubmontagemSerialController.updateSequence);
router.get('/submontagem-seriais/:id', requireApiRoles(OPERATION_READ_ROLES), SubmontagemSerialController.getById);
router.post('/submontagem-seriais/lote', requireApiRoles(OPERATION_WRITE_ROLES), SubmontagemSerialController.createBatch);
router.post('/submontagem-seriais/:id/trocar-modelo', requireApiRoles(OPERATION_WRITE_ROLES), SubmontagemSerialController.changeAvailableModel);
router.patch('/submontagem-seriais/:id/modelo-servo', requireApiRoles(OPERATION_WRITE_ROLES), SubmontagemSerialController.updateModeloServo);
router.patch('/submontagem-seriais/:id/pedido-saida', requireApiRoles(ADMIN_WRITE_ROLES), SubmontagemSerialController.updatePedidoSaida);

module.exports = router;
