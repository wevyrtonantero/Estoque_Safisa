const express = require('express');
const ChatController = require('../controllers/ChatController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ALL_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/chat/usuarios', requireApiRoles(ALL_ROLES), ChatController.listUsers);
router.post('/chat/presenca', requireApiRoles(ALL_ROLES), ChatController.touchPresence);
router.get('/chat/conversas/:usuarioId', requireApiRoles(ALL_ROLES), ChatController.getConversation);
router.post('/chat/conversas/:usuarioId/mensagens', requireApiRoles(ALL_ROLES), ChatController.sendMessage);
router.post('/chat/conversas/:usuarioId/visualizar', requireApiRoles(ALL_ROLES), ChatController.markConversationAsRead);

module.exports = router;
