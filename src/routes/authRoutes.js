const express = require('express');

const AuthController = require('../controllers/AuthController');

const router = express.Router();

router.get('/auth/status', AuthController.getStatus);
router.get('/auth/me', AuthController.getMe);
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);

module.exports = router;
