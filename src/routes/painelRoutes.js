const express = require('express');

const PainelController = require('../controllers/PainelController');

const router = express.Router();

router.get('/painel/resumo', PainelController.getSummary);

module.exports = router;
