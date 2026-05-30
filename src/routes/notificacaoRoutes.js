const express = require('express');

const NotificacaoController = require('../controllers/NotificacaoController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ALL_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/notificacoes', requireApiRoles(ALL_ROLES), NotificacaoController.list);
router.post('/notificacoes/lidas', requireApiRoles(ALL_ROLES), NotificacaoController.markAllAsRead);
router.post('/notificacoes/:id/lida', requireApiRoles(ALL_ROLES), NotificacaoController.markAsRead);

module.exports = router;
