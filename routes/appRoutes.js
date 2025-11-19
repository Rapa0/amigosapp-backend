const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const authController = require('../controllers/authController');

const auth = authController.usuarioAutenticado;

router.get('/candidatos', auth, appController.obtenerCandidatos);
router.post('/like', auth, appController.darLike);
router.get('/matches', auth, appController.obtenerMatches);
router.get('/mensajes/:idReceptor', auth, appController.obtenerMensajes);

module.exports = router;