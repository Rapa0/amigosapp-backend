const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = authController.usuarioAutenticado;

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/olvide-password', authController.olvidePassword);
router.post('/comprobar-token', authController.comprobarToken);
router.post('/nuevo-password', authController.nuevoPassword);
router.put('/perfil', auth, authController.actualizarPerfil);
router.delete('/perfil', auth, authController.eliminarCuenta);

module.exports = router;