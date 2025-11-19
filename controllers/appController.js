const User = require('../models/User');
const Message = require('../models/Message');

exports.obtenerCandidatos = async (req, res) => {
    try {
        const usuarioActual = await User.findById(req.usuario._id);
        const excluidos = [usuarioActual._id, ...usuarioActual.likes, ...usuarioActual.dislikes];

        let filtro = { _id: { $nin: excluidos } };

        if (usuarioActual.preferencia && usuarioActual.preferencia !== 'Ambos') {
            filtro.genero = usuarioActual.preferencia; 
        }

        const candidatos = await User.find(filtro).limit(20);

        res.json(candidatos);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error obteniendo candidatos');
    }
};

exports.darLike = async (req, res) => {
    try {
        const { idCandidato } = req.body;
        const usuarioActual = await User.findById(req.usuario._id);
        const candidato = await User.findById(idCandidato);

        if (!candidato) return res.status(404).json({ msg: 'Usuario no encontrado' });

        if (!usuarioActual.likes.includes(idCandidato)) {
            usuarioActual.likes.push(idCandidato);
            await usuarioActual.save();
        }

        let isMatch = false;
        if (candidato.likes.includes(usuarioActual._id)) {
            isMatch = true;
            
            if (!usuarioActual.matches.includes(candidato._id)) {
                usuarioActual.matches.push(candidato._id);
                await usuarioActual.save();
            }
            if (!candidato.matches.includes(usuarioActual._id)) {
                candidato.matches.push(usuarioActual._id);
                await candidato.save();
            }
        }

        res.json({ msg: 'Like registrado', match: isMatch });

    } catch (error) {
        console.log(error);
        res.status(500).send('Error al dar like');
    }
};

exports.obtenerMatches = async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario._id)
            .populate('matches', 'nombre email imagen'); 
        
        res.json(usuario.matches);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error obteniendo matches');
    }
};

exports.obtenerMensajes = async (req, res) => {
    try {
        const { idReceptor } = req.params;
        const idRemitente = req.usuario._id;

        const mensajes = await Message.find({
            $or: [
                { remitente: idRemitente, receptor: idReceptor },
                { remitente: idReceptor, receptor: idRemitente }
            ]
        }).sort({ createdAt: 1 });

        res.json(mensajes);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error obteniendo mensajes');
    }
};