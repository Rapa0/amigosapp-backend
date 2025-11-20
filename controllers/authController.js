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
    
    if(password.length < 6) return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres' });
    if(!imagen) return res.status(400).json({ msg: 'La foto de perfil es obligatoria' });

    try {
        const codigo = Math.floor(100000 + Math.random() * 900000).toString().replace(/[^0-9]/g, '');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const usuarioExistente = await User.findOne({ email, cuentaConfirmada: true });
        if (usuarioExistente) {
            return res.status(400).json({ msg: 'El usuario ya existe' });
        }

        await User.findOneAndUpdate(
            { email: email },
            {
                nombre,
                password: hashedPassword,
                imagen,
                token: codigo,
                cuentaConfirmada: false
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log(`>> CODIGO GENERADO para ${email}: [${codigo}]`);

        if (transporter) {
            await transporter.sendMail({
                to: email,
                from: process.env.EMAIL_SENDER,
                subject: 'Código de Verificación',
                html: `<h1>${codigo}</h1>`
            });
        }

        res.json({ msg: 'Código enviado' });

    } catch (error) {
        console.log(error);
        res.status(500).send('Error en registro');
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

        const tokenBD = String(usuario.token || '').trim();
        const tokenUser = String(codigo || '').replace(/\s/g, '').trim();

        console.log(`DEBUG FINAL: Longitud BD: ${tokenBD.length}, Longitud User: ${tokenUser.length}`);
        console.log(`COMPARACIÓN FINAL: BD: ${JSON.stringify(tokenBD)} vs USER: ${JSON.stringify(tokenUser)}`);

        if (tokenBD !== tokenUser) {
            let debugChars = 'Códigos de caracteres (solo si falla):';
            for (let i = 0; i < Math.max(tokenBD.length, tokenUser.length); i++) {
                const charBD = tokenBD.charCodeAt(i) || '---';
                const charUser = tokenUser.charCodeAt(i) || '---';
                if (charBD !== charUser) {
                    debugChars += ` Pos ${i}: BD[${charBD}] vs USER[${charUser}] |`;
                }
            }
            console.log(debugChars);

            return res.status(400).json({ msg: `Incorrecto. BD: ${tokenBD} / Tú: ${tokenUser}` });
        }

        usuario.token = null;
        usuario.cuentaConfirmada = true;
        await usuario.save();

        res.json({ msg: 'Cuenta verificada' });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error al verificar');
    }
};

exports.login = async (req, res) => {
    const { password } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    try {
        let usuario = await User.findOne({ email });
        if (!usuario || !usuario.cuentaConfirmada) return res.status(400).json({ msg: 'Credenciales inválidas' });
        const passCorrecto = await bcrypt.compare(password, usuario.password);
        if (!passCorrecto) return res.status(400).json({ msg: 'Credenciales inválidas' });
        res.json({
            token: generarJWT(usuario._id),
            usuario: {
                _id: usuario._id, nombre: usuario.nombre, email: usuario.email, imagen: usuario.imagen,
                galeria: usuario.galeria, descripcion: usuario.descripcion, edad: usuario.edad,
                genero: usuario.genero, preferencia: usuario.preferencia
            }
        });
    } catch (error) { res.status(500).send('Hubo un error'); }
};

exports.olvidePassword = async (req, res) => {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    try {
        const usuario = await User.findOne({ email });
        if (!usuario) return res.json({ msg: 'Enviado' });
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        usuario.token = codigo; await usuario.save();
        if(transporter) await transporter.sendMail({to: email, from: process.env.EMAIL_SENDER, subject: 'Recuperar', html: `<h1>${codigo}</h1>`});
        res.json({ msg: 'Enviado' });
    } catch (error) { res.status(500).send('Error'); }
};

exports.comprobarToken = async (req, res) => {
    const { token } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    try {
        const u = await User.findOne({ email });
        if (!u || String(u.token).trim() !== String(token).trim()) return res.status(400).json({ msg: 'Incorrecto' });
        res.json({ msg: 'Correcto' });
    } catch (error) { res.status(500).send('Error'); }
};

exports.nuevoPassword = async (req, res) => {
    const { token, password } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    if(password.length < 6) return res.status(400).json({ msg: 'Mínimo 6 caracteres' });
    try {
        const u = await User.findOne({ email });
        if (!u || String(u.token).trim() !== String(token).trim()) return res.status(400).json({ msg: 'Error' });
        const s = await bcrypt.genSalt(10);
        u.password = await bcrypt.hash(password, s);
        u.token = null; await u.save();
        res.json({ msg: 'Password cambiado' });
    } catch (error) { res.status(500).send('Error'); }
};

exports.actualizarPerfil = async (req, res) => {
    try {
        const u = await User.findById(req.usuario._id);
        if(!u) return res.status(404).json({msg:'No user'});
        const {nombre,descripcion,edad,genero,preferencia,galeria}=req.body;
        if(nombre) u.nombre = nombre;
        if(descripcion) u.descripcion = descripcion;
        if(edad) u.edad = edad;
        if(genero) u.genero = genero;
        if(preferencia) u.preferencia = preferencia;
        if(galeria) u.galeria = galeria;
        await u.save();
        res.json({ msg: 'Actualizado', usuario: u });
    } catch (error) { res.status(500).send('Error'); }
};

exports.eliminarCuenta = async (req, res) => {
    try { await User.findByIdAndDelete(req.usuario._id); res.json({msg:'Borrado'}); }
    catch (error) { res.status(500).send('Error'); }
};

exports.usuarioAutenticado = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.usuario = await User.findById(decoded.id).select('-password');
            return next();
        } catch (error) { return res.status(404).json({ msg: 'Token no válido' }); }
    }
    if (!token) return res.status(401).json({ msg: 'No autenticado' });
};