const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB Conectada Exitósamente');
    } catch (error) {
        console.log('Error en DB:', error);
        process.exit(1);
    }
}
module.exports = conectarDB;