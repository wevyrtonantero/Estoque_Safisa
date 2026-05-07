const express = require('express');

const EstoqueEspecialController = require('../controllers/EstoqueEspecialController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES, OPERATION_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/estoques-especiais/:tipo/registros', requireApiRoles(OPERATION_READ_ROLES), EstoqueEspecialController.getRegistros);
router.post('/estoques-especiais/:tipo/registros/:id/refugo', requireApiRoles(OPERATION_WRITE_ROLES), EstoqueEspecialController.registrarRefugo);
router.post('/estoques-especiais/:tipo/registros/:id/enviar-estoque', requireApiRoles(OPERATION_WRITE_ROLES), EstoqueEspecialController.enviarParaEstoque);
router.post('/estoques-especiais/:tipo/registros/:id/enviar-tratamento', requireApiRoles(OPERATION_WRITE_ROLES), EstoqueEspecialController.enviarParaTratamento);

module.exports = router;
