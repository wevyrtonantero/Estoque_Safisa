// Rotas auxiliares para popular selects do frontend administrativo.
const express = require('express');

const CadastroApoioController = require('../controllers/CadastroApoioController');

const router = express.Router();

// Rota unica para carregar opcoes auxiliares dos formularios.
router.get('/opcoes-cadastro', CadastroApoioController.getFormOptions);

module.exports = router;
