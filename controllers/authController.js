const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');

let transporter;
if (process.env.SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport(sendgridTransport({
        auth: { api_key: process.env.SENDGRID_API_KEY }
    }));
}

const generarJWT = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.registrar = async (req, res) => {
    const { password, nombre, imagen } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    
    if(password.length < 6) {
        return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres' });
    }

    if(!imagen) {
        return res.status(400).json({ msg: 'La foto de perfil es obligatoria' });
    }

    try {
        let usuario = await User.findOne({ email });
        
        if (usuario && usuario.cuentaConfirmada) {
            return res.status(400).json({ msg: 'El usuario ya existe' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();

        if (usuario && !usuario.cuentaConfirmada) {
            usuario.nombre = nombre;
            usuario.password = hashedPassword;
            usuario.imagen = imagen;
            usuario.token = codigo;
        } else {
            usuario = new User({
                nombre,
                email,
                password: hashedPassword,
                imagen,
                token: codigo,
                cuentaConfirmada: false 
            });
        }

        await usuario.save();
        console.log(`CODIGO: ${codigo} PARA: ${email}`);

        if (transporter) {
            await transporter.sendMail({
                to: email,
                from: process.env.EMAIL_SENDER,
                subject: 'Verifica tu cuenta - AmigosApp',
                html: `
                    <h1>¡Bienvenido, ${nombre}!</h1>
                    <p>Tu código de verificación es:</p>
                    <h2 style="color: #6C63FF;">${codigo}</h2>
                `
            });
        }

        res.json({ msg: 'Código enviado. Verifica tu correo.' });
    } catch (error) {
        res.status(500).send('Hubo un error al registrar');
    }
};

exports.verificarCuenta = async (req, res) => {
    const { codigo } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';

    try {
        const usuario = await User.findOne({ email });
        
        if (!usuario) {
            return res.status(400).json({ msg: 'Usuario no encontrado' });
        }

        if (String(usuario.token).trim() !== String(codigo).trim()) {
            return res.status(400).json({ msg: 'Código incorrecto' });
        }

        usuario.token = null;
        usuario.cuentaConfirmada = true;
        await usuario.save();

        res.json({ msg: 'Cuenta verificada exitosamente' });
    } catch (error) {
        res.status(500).send('Error al verificar');
    }
};

exports.login = async (req, res) => {
    const { password } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';

    try {
        let usuario = await User.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        if (!usuario.cuentaConfirmada) {
            return res.status(400).json({ msg: 'Debes verificar tu cuenta primero' });
        }

        const passCorrecto = await bcrypt.compare(password, usuario.password);
        if (!passCorrecto) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        res.json({
            token: generarJWT(usuario._id),
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                imagen: usuario.imagen,
                galeria: usuario.galeria,
                descripcion: usuario.descripcion,
                edad: usuario.edad,
                genero: usuario.genero,
                preferencia: usuario.preferencia
            }
        });
    } catch (error) {
        res.status(500).send('Hubo un error');
    }
};

exports.olvidePassword = async (req, res) => {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    try {
        const usuario = await User.findOne({ email });
        const mensajeFeedback = 'Si existe el correo estará en tu bandeja de spam';

        if (!usuario) return res.json({ msg: mensajeFeedback });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        usuario.token = codigo;
        await usuario.save();

        if (transporter) {
            await transporter.sendMail({
                to: email,
                from: process.env.EMAIL_SENDER,
                subject: 'Recuperar Contraseña - AmigosApp',
                html: `<h1>Tu código es: <b>${codigo}</b></h1>`
            });
        }
        res.json({ msg: mensajeFeedback });

    } catch (error) {
        res.status(500).send('Error al enviar correo');
    }
};

exports.comprobarToken = async (req, res) => {
    const { token } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';

    try {
        const usuario = await User.findOne({ email });
        if (!usuario) return res.status(400).json({ msg: 'Usuario no encontrado' });

        if (String(usuario.token).trim() !== String(token).trim()) {
            return res.status(400).json({ msg: 'Código incorrecto' });
        }
        res.json({ msg: 'Código válido' });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.nuevoPassword = async (req, res) => {
    const { token, password } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';

    if(password.length < 6) {
        return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        const usuario = await User.findOne({ email });
        if (!usuario) return res.status(400).json({ msg: 'Operación no válida' });
        if (String(usuario.token).trim() !== String(token).trim()) return res.status(400).json({ msg: 'Token inválido' });

        const salt = await bcrypt.genSalt(10);
        usuario.password = await bcrypt.hash(password, salt);
        usuario.token = null;
        await usuario.save();

        res.json({ msg: 'Contraseña modificada correctamente' });
    } catch (error) {
        res.status(500).send('Error');
    }
};

exports.actualizarPerfil = async (req, res) => {
    try {
        const { nombre, descripcion, edad, genero, preferencia, galeria } = req.body;
        
        const usuario = await User.findById(req.usuario._id);
        if (!usuario) return res.status(404).json({ msg: 'Usuario no encontrado' });

        if (nombre) usuario.nombre = nombre;
        if (descripcion) usuario.descripcion = descripcion;
        if (edad) usuario.edad = edad;
        if (genero) usuario.genero = genero;
        if (preferencia) usuario.preferencia = preferencia;
        if (galeria) usuario.galeria = galeria;

        await usuario.save();

        res.json({ 
            msg: 'Perfil actualizado', 
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                imagen: usuario.imagen,
                galeria: usuario.galeria,
                descripcion: usuario.descripcion,
                edad: usuario.edad,
                genero: usuario.genero,
                preferencia: usuario.preferencia
            }
        });

    } catch (error) {
        res.status(500).send('Error al actualizar');
    }
};

exports.eliminarCuenta = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.usuario._id);
        res.json({ msg: 'Cuenta eliminada correctamente' });
    } catch (error) {
        res.status(500).send('Error al eliminar');
    }
};

exports.usuarioAutenticado = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.usuario = await User.findById(decoded.id).select('-password');
            return next();
        } catch (error) {
            return res.status(404).json({ msg: 'Token no válido' });
        }
    }
    if (!token) {
        return res.status(401).json({ msg: 'No autenticado' });
    }
};