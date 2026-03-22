const express = require('express');

const TerceirizacaoRemessaController = require('../controllers/TerceirizacaoRemessaController');

const router = express.Router();

router.get('/terceirizacao/opcoes', TerceirizacaoRemessaController.getOptions);
router.get('/terceirizacao/remessas', TerceirizacaoRemessaController.getAll);
router.get('/terceirizacao/remessas/:id', TerceirizacaoRemessaController.getById);
router.post('/terceirizacao/encaminhar', TerceirizacaoRemessaController.createDispatch);
router.post('/terceirizacao/remessas/:id/nf', TerceirizacaoRemessaController.updateNf);
router.post('/terceirizacao/retorno', TerceirizacaoRemessaController.registerReturn);

module.exports = router;
