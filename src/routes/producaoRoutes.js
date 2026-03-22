const express = require('express');

const ProducaoController = require('../controllers/ProducaoController');

const router = express.Router();

router.get('/producao', ProducaoController.getAll);
router.get('/producao/:id', ProducaoController.getById);
router.post('/producao', ProducaoController.create);
router.post('/producao/:id/finalizar', ProducaoController.finish);
router.delete('/producao/:id', ProducaoController.delete);

module.exports = router;
