const express = require('express');

const EtiquetaController = require('../controllers/EtiquetaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ADMIN_READ_ROLES, ADMIN_WRITE_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/etiquetas', requireApiRoles(ADMIN_READ_ROLES), EtiquetaController.getAll);
router.get('/etiquetas/codigo/:codigoItem', requireApiRoles(ADMIN_READ_ROLES), EtiquetaController.getByCodigo);
router.post('/etiquetas', requireApiRoles(ADMIN_WRITE_ROLES), EtiquetaController.create);
router.put('/etiquetas/:id', requireApiRoles(ADMIN_WRITE_ROLES), EtiquetaController.update);
router.patch('/etiquetas/:id/status', requireApiRoles(ADMIN_WRITE_ROLES), EtiquetaController.updateStatus);
router.post('/etiquetas/gerar-zpl', requireApiRoles(ADMIN_READ_ROLES), EtiquetaController.gerarZpl);
router.post('/etiquetas/importar-legado', requireApiRoles(ADMIN_WRITE_ROLES), EtiquetaController.importLegacyFolder);
router.post('/etiquetas/:id/replicar-layout', requireApiRoles(ADMIN_WRITE_ROLES), EtiquetaController.replicateLayout);

module.exports = router;
