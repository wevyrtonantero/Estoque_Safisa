const express = require('express');

const TerceirizacaoRemessaController = require('../controllers/TerceirizacaoRemessaController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const {
  REMESSA_READ_ROLES,
  REMESSA_WRITE_ROLES,
  ADMIN_WRITE_ROLES
} = require('../security/roles');

const router = express.Router();

router.get('/terceirizacao/opcoes', requireApiRoles(REMESSA_READ_ROLES), TerceirizacaoRemessaController.getOptions);
router.get('/terceirizacao/remessas', requireApiRoles(REMESSA_READ_ROLES), TerceirizacaoRemessaController.getAll);
router.get('/terceirizacao/retornos-pendentes', requireApiRoles(REMESSA_READ_ROLES), TerceirizacaoRemessaController.getPendingReturns);
router.get('/terceirizacao/remessas/:id', requireApiRoles(REMESSA_READ_ROLES), TerceirizacaoRemessaController.getById);
router.post('/terceirizacao/encaminhar', requireApiRoles(REMESSA_WRITE_ROLES), TerceirizacaoRemessaController.createDispatch);
router.post('/terceirizacao/remessas/:id/nf', requireApiRoles(ADMIN_WRITE_ROLES), TerceirizacaoRemessaController.updateNf);
router.post('/terceirizacao/retorno', requireApiRoles(REMESSA_WRITE_ROLES), TerceirizacaoRemessaController.registerReturn);
router.post('/terceirizacao/finalizar-pendencia', requireApiRoles(REMESSA_WRITE_ROLES), TerceirizacaoRemessaController.finalizePendingItem);

module.exports = router;
