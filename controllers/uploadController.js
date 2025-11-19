const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'amigos_app',
        allowed_formats: ['jpg', 'png', 'jpeg']
    }
});

const upload = multer({ storage: storage });

exports.subirImagen = upload.single('imagen'); 

exports.respuestaUpload = (req, res) => {
    if (req.file && req.file.path) {
        res.json({ url: req.file.path });
    } else {
        res.status(400).json({ msg: 'Error al subir la imagen' });
    }
};