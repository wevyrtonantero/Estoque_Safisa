const express = require('express');

const PedidoExpedicaoController = require('../controllers/PedidoExpedicaoController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { OPERATION_READ_ROLES, OPERATION_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/pedidos-expedicao', requireApiRoles(OPERATION_READ_ROLES), PedidoExpedicaoController.list);
router.get('/pedidos-expedicao/clientes', requireApiRoles(OPERATION_READ_ROLES), PedidoExpedicaoController.listClientes);
router.patch('/pedidos-expedicao/prioridades', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.reorder);
router.post('/pedidos-expedicao', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.create);
router.patch('/pedidos-expedicao/:id', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.update);
router.patch('/pedidos-expedicao/:id/programacao-hoje', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.updateProgramacaoHoje);
router.get('/pedidos-expedicao/:id', requireApiRoles(OPERATION_READ_ROLES), PedidoExpedicaoController.getById);
router.get('/pedidos-expedicao/itens/:itemId/seriais', requireApiRoles(OPERATION_READ_ROLES), PedidoExpedicaoController.getItemSeriais);
router.post('/pedidos-expedicao/itens/:itemId/seriais', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.bindSeriais);
router.delete('/pedidos-expedicao/seriais/:bindingId', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.unbindSerial);
router.patch('/pedidos-expedicao/itens/:itemId/separado', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.toggleItemSeparado);
router.patch('/pedidos-expedicao/:id/nota-fiscal', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.updateNotaFiscal);
router.patch('/pedidos-expedicao/:id/dados-finais', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.updateDadosFinais);
router.post('/pedidos-expedicao/:id/coletar', requireApiRoles(OPERATION_WRITE_ROLES), PedidoExpedicaoController.coletar);

module.exports = router;
