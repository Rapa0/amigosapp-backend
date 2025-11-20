const User = require('../models/User');
const Message = require('../models/Message');

exports.obtenerCandidatos = async (req, res) => {
    try {
        const usuarioActual = await User.findById(req.usuario._id);
        
        const excluidos = [
            req.usuario._id, 
            ...(usuarioActual.matches || []), 
            ...(usuarioActual.dislikes || []),
            ...(usuarioActual.likes || [])
        ];

        let filtro = { _id: { $nin: excluidos } };

        if (usuarioActual.preferencia && usuarioActual.preferencia !== 'Ambos') {
            filtro.genero = usuarioActual.preferencia; 
        }

        const candidatos = await User.find(filtro).limit(20);
        res.json(candidatos);
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.darLike = async (req, res) => {
    try {
        const { idCandidato } = req.body;
        const myId = req.usuario._id;
        const usuarioActual = await User.findById(myId);

        if (!usuarioActual.likes.includes(idCandidato)) {
            await User.findByIdAndUpdate(myId, { $addToSet: { likes: idCandidato } });
            if (req.io) {
                req.io.to(idCandidato).emit('nueva_notificacion', { tipo: 'like' });
            }
        }

        const candidato = await User.findById(idCandidato);
        let isMatch = false;

        if (candidato.likes.includes(myId)) {
            isMatch = true;
            await User.findByIdAndUpdate(myId, { $addToSet: { matches: idCandidato } });
            await User.findByIdAndUpdate(idCandidato, { $addToSet: { matches: myId } });
            
            if (req.io) {
                req.io.to(idCandidato).emit('nueva_notificacion', { tipo: 'match' });
            }
        }

        res.json({ msg: 'Like registrado', match: isMatch });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.superLike = async (req, res) => {
    try {
        const { idCandidato, mensaje } = req.body;
        const myId = req.usuario._id;

        await User.findByIdAndUpdate(myId, { $addToSet: { likes: idCandidato } });

        if (mensaje) {
            await Message.create({
                remitente: myId,
                receptor: idCandidato,
                mensaje: mensaje,
                tipo: 'texto'
            });
        }

        if (req.io) {
            req.io.to(idCandidato).emit('nueva_notificacion', { tipo: 'superlike' });
        }

        const candidato = await User.findById(idCandidato);
        let isMatch = false;
        if (candidato.likes.includes(myId)) {
            isMatch = true;
            await User.findByIdAndUpdate(myId, { $addToSet: { matches: idCandidato } });
            await User.findByIdAndUpdate(idCandidato, { $addToSet: { matches: myId } });

            if (req.io) {
                req.io.to(idCandidato).emit('nueva_notificacion', { tipo: 'match' });
            }
        }

        res.json({ msg: 'Super Like enviado', match: isMatch });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.obtenerSolicitudes = async (req, res) => {
    try {
        const usuarios = await User.find({
            likes: req.usuario._id,
            matches: { $ne: req.usuario._id } 
        }).select('nombre email imagen edad descripcion galeria').lean();

        const solicitudesCompletas = await Promise.all(usuarios.map(async (usuario) => {
            const mensaje = await Message.findOne({
                remitente: usuario._id,
                receptor: req.usuario._id
            }).sort({ createdAt: 1 });

            return {
                ...usuario,
                mensajeInicial: mensaje ? mensaje.mensaje : null
            };
        }));

        res.json(solicitudesCompletas);
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.gestionarSolicitud = async (req, res) => {
    const { idCandidato, accion } = req.body;
    const myId = req.usuario._id;
    
    try {
        if (accion === 'aceptar') {
            await User.findByIdAndUpdate(myId, { $addToSet: { likes: idCandidato, matches: idCandidato } });
            await User.findByIdAndUpdate(idCandidato, { $addToSet: { matches: myId } });
            return res.json({ msg: 'Solicitud Aceptada' });

        } else if (accion === 'rechazar') {
            await User.findByIdAndUpdate(idCandidato, { $pull: { likes: myId } });
            await User.findByIdAndUpdate(myId, { $addToSet: { dislikes: idCandidato } });
            return res.json({ msg: 'Solicitud Rechazada' });
        }
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.eliminarMatch = async (req, res) => {
    const { idUsuario } = req.body;
    const myId = req.usuario._id;

    try {
        await User.findByIdAndUpdate(myId, { 
            $pull: { matches: idUsuario, likes: idUsuario, dislikes: idUsuario } 
        });

        await User.findByIdAndUpdate(idUsuario, { 
            $pull: { matches: myId, likes: myId, dislikes: myId } 
        });

        await Message.deleteMany({
            $or: [
                { remitente: myId, receptor: idUsuario },
                { remitente: idUsuario, receptor: myId }
            ]
        });

        res.json({ msg: 'Match eliminado y reseteado completamente' });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.reiniciarBusqueda = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.usuario._id, { 
            $set: { dislikes: [] } 
        });
        res.json({ msg: 'Historial de rechazos borrado' });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.obtenerMatches = async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario._id)
            .populate('matches', 'nombre email imagen'); 
        
        res.json(usuario.matches);
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.obtenerMensajes = async (req, res) => {
    try {
        const mensajes = await Message.find({
            $or: [
                { remitente: req.usuario._id, receptor: req.params.idReceptor },
                { remitente: req.params.idReceptor, receptor: req.usuario._id }
            ]
        }).sort({ createdAt: 1 });

        res.json(mensajes);
    } catch (error) {
        res.status(500).send('Error');
    }
};