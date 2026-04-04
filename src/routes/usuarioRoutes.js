const express = require('express');

const UsuarioController = require('../controllers/UsuarioController');
const { requireApiRoles } = require('../middleware/authMiddleware');
const { SUPERADMIN_ONLY_ROLES } = require('../security/roles');

const router = express.Router();

router.get('/usuarios', requireApiRoles(SUPERADMIN_ONLY_ROLES), UsuarioController.getAll);
router.get('/usuarios/:id', requireApiRoles(SUPERADMIN_ONLY_ROLES), UsuarioController.getById);
router.post('/usuarios', requireApiRoles(SUPERADMIN_ONLY_ROLES), UsuarioController.create);
router.put('/usuarios/:id', requireApiRoles(SUPERADMIN_ONLY_ROLES), UsuarioController.update);
router.delete('/usuarios/:id', requireApiRoles(SUPERADMIN_ONLY_ROLES), UsuarioController.delete);

module.exports = router;
