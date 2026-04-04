// Rotas auxiliares para popular selects do frontend administrativo.
const express = require('express');

const CadastroApoioController = require('../controllers/CadastroApoioController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { ADMIN_READ_ROLES } = require('../security/roles');

const router = express.Router();

// Rota unica para carregar opcoes auxiliares dos formularios.
router.get('/opcoes-cadastro', requireApiRoles(ADMIN_READ_ROLES), CadastroApoioController.getFormOptions);

module.exports = router;
