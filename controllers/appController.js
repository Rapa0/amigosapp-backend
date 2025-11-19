const User = require('../models/User');
const Message = require('../models/Message');

exports.obtenerCandidatos = async (req, res) => {
    try {
        const usuarioActual = await User.findById(req.usuario._id);
        
        const excluidos = [usuarioActual._id, ...usuarioActual.matches, ...usuarioActual.dislikes];
        const misLikes = usuarioActual.likes;

        let filtro = { 
            _id: { $nin: [...excluidos, ...misLikes] } 
        };

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
            if (!usuarioActual.matches.includes(idCandidato)) {
                usuarioActual.matches.push(idCandidato);
                await usuarioActual.save();
            }
            if (!candidato.matches.includes(usuarioActual._id)) {
                candidato.matches.push(usuarioActual._id);
                await candidato.save();
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
        const usuarioActual = await User.findById(req.usuario._id);
        const candidato = await User.findById(idCandidato);

        if (!candidato) return res.status(404).json({ msg: 'Usuario no encontrado' });

        if (!usuarioActual.likes.includes(idCandidato)) {
            usuarioActual.likes.push(idCandidato);
            await usuarioActual.save();
        }

        if (mensaje) {
            const nuevoMensaje = new Message({
                remitente: usuarioActual._id,
                receptor: idCandidato,
                mensaje: mensaje,
                tipo: 'texto',
                leido: false
            });
            await nuevoMensaje.save();
        }

        let isMatch = false;
        if (candidato.likes.includes(usuarioActual._id)) {
            isMatch = true;
            if (!usuarioActual.matches.includes(idCandidato)) {
                usuarioActual.matches.push(idCandidato);
                await usuarioActual.save();
            }
            if (!candidato.matches.includes(usuarioActual._id)) {
                candidato.matches.push(usuarioActual._id);
                await candidato.save();
            }
        }
        res.json({ msg: 'Super Like enviado', match: isMatch });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.obtenerSolicitudes = async (req, res) => {
    try {
        const solicitudes = await User.find({
            likes: req.usuario._id,
            matches: { $ne: req.usuario._id } 
        }).select('nombre email imagen edad descripcion galeria');

        res.json(solicitudes);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al obtener solicitudes');
    }
};

exports.gestionarSolicitud = async (req, res) => {
    const { idCandidato, accion } = req.body;
    
    try {
        const yo = await User.findById(req.usuario._id);
        const elOtro = await User.findById(idCandidato);

        if (accion === 'aceptar') {
            if (!yo.likes.includes(idCandidato)) yo.likes.push(idCandidato);
            if (!yo.matches.includes(idCandidato)) yo.matches.push(idCandidato);
            if (!elOtro.matches.includes(yo._id)) elOtro.matches.push(yo._id);
            
            await yo.save();
            await elOtro.save();
            return res.json({ msg: 'Solicitud Aceptada' });

        } else if (accion === 'rechazar') {
            elOtro.likes = elOtro.likes.filter(id => id.toString() !== yo._id.toString());
            await elOtro.save();
            
            return res.json({ msg: 'Solicitud Rechazada' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Error gestionando solicitud');
    }
};

exports.eliminarMatch = async (req, res) => {
    const { idUsuario } = req.body;
    try {
        const yo = await User.findById(req.usuario._id);
        const elOtro = await User.findById(idUsuario);

        yo.matches = yo.matches.filter(id => id.toString() !== idUsuario);
        if(elOtro) elOtro.matches = elOtro.matches.filter(id => id.toString() !== yo._id.toString());

        yo.likes = yo.likes.filter(id => id.toString() !== idUsuario);
        if(elOtro) elOtro.likes = elOtro.likes.filter(id => id.toString() !== yo._id.toString());
        
        yo.dislikes = yo.dislikes.filter(id => id.toString() !== idUsuario);

        await yo.save();
        if(elOtro) await elOtro.save();

        await Message.deleteMany({
            $or: [
                { remitente: yo._id, receptor: idUsuario },
                { remitente: idUsuario, receptor: yo._id }
            ]
        });

        res.json({ msg: 'Match eliminado y reseteado' });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error eliminando match');
    }
};

exports.reiniciarBusqueda = async (req, res) => {
    try {
        const usuario = await User.findById(req.usuario._id);
        usuario.dislikes = [];
        await usuario.save();
        res.json({ msg: 'Historial de rechazos borrado' });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al reiniciar');
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
        const mensajes = await Message.find({
            $or: [
                { remitente: req.usuario._id, receptor: req.params.idReceptor },
                { remitente: req.params.idReceptor, receptor: req.usuario._id }
            ]
        }).sort({ createdAt: 1 });

        res.json(mensajes);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error obteniendo mensajes');
    }
};