const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    remitente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receptor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mensaje: { type: String, required: true }, 
    tipo: { type: String, enum: ['texto', 'imagen'], default: 'texto' },
    leido: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);