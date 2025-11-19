const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const authController = require('../controllers/authController');

const auth = authController.usuarioAutenticado;

router.get('/candidatos', auth, appController.obtenerCandidatos);
router.post('/like', auth, appController.darLike);
router.post('/superlike', auth, appController.superLike);
router.get('/solicitudes', auth, appController.obtenerSolicitudes);
router.post('/solicitudes', auth, appController.gestionarSolicitud);
router.post('/eliminarmatch', auth, appController.eliminarMatch);
router.post('/reiniciar', auth, appController.reiniciarBusqueda);
router.get('/matches', auth, appController.obtenerMatches);
router.get('/mensajes/:idReceptor', auth, appController.obtenerMensajes);

module.exports = router;