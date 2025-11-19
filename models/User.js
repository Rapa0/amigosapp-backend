const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    token: { type: String, default: null },
    
    imagen: { type: String, default: '' },
    galeria: [{ type: String }],
    descripcion: { type: String, default: '' },
    edad: { type: Number },
    genero: { type: String, enum: ['Hombre', 'Mujer', 'Otro'], default: 'Otro' },
    preferencia: { type: String, enum: ['Hombre', 'Mujer', 'Ambos'], default: 'Ambos' },
    
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);