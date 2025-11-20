const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const conectarDB = require('./config/db');
const Message = require('./models/Message');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

conectarDB();

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Servidor Encendido y Listo');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/app', require('./routes/appRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado al socket:', socket.id);

    socket.on('entrar_chat', (userId) => {
        socket.join(userId);
        console.log(`Usuario ${userId} entró a su sala.`);
    });

    socket.on('enviar_mensaje', async (data) => {
        const { remitente, receptor, mensaje, tipo } = data;

        try {
            const nuevoMsg = new Message({
                remitente,
                receptor,
                mensaje,
                tipo: tipo || 'texto' 
            });
            await nuevoMsg.save();

            io.to(receptor).emit('nuevo_mensaje', nuevoMsg);
            io.to(remitente).emit('nuevo_mensaje', nuevoMsg);

        } catch (error) {
            console.log('Error socket:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});