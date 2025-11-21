require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const authController = require('./controllers/authController');

// Mock Express Request/Response
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    res.send = (msg) => {
        res.data = msg;
        return res;
    };
    return res;
};

const runTest = async () => {
    console.log('>>> INICIANDO TEST DE DEBUG >>>');
    
    // 1. Connect to DB
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.DB_MONGO);
        console.log('DB Conectada');
    } catch (error) {
        console.error('Error conectando DB:', error);
        process.exit(1);
    }

    const testEmail = 'test_debug_agent@example.com';
    const testPassword = 'password123';

    // 2. Cleanup
    await User.deleteOne({ email: testEmail });
    console.log('Usuario de prueba limpiado');

    // 3. Test Registration (First Attempt)
    console.log('\n--- INTENTO REGISTRO 1 ---');
    const reqReg1 = {
        body: {
            nombre: 'Test User',
            email: testEmail,
            password: testPassword,
            imagen: 'avatar.jpg'
        }
    };
    const resReg1 = mockRes();
    await authController.registrar(reqReg1, resReg1);
    console.log('Respuesta Registro 1:', resReg1.data);

    // 4. Get Token from DB
    const user1 = await User.findOne({ email: testEmail });
    const token1 = user1.token;
    console.log('Token generado en BD:', token1);

    if (!token1) {
        console.error('FALLO: No se generó token');
        process.exit(1);
    }

    // 5. Test Registration (Second Attempt - Immediate)
    console.log('\n--- INTENTO REGISTRO 2 (Inmediato) ---');
    const resReg2 = mockRes();
    await authController.registrar(reqReg1, resReg2);
    console.log('Respuesta Registro 2:', resReg2.data);

    const user2 = await User.findOne({ email: testEmail });
    const token2 = user2.token;
    console.log('Token en BD tras intento 2:', token2);

    if (token1 !== token2) {
        console.error('FALLO: El token cambió tras el segundo intento (Race condition no solucionada)');
    } else {
        console.log('EXITO: El token se mantuvo igual (Race condition solucionada)');
    }

    // 6. Test Verification
    console.log('\n--- INTENTO VERIFICACION ---');
    const reqVer = {
        body: {
            email: testEmail,
            codigo: token1 // Usamos el token que sabemos que está en BD
        }
    };
    const resVer = mockRes();
    await authController.verificarCuenta(reqVer, resVer);
    console.log('Respuesta Verificación:', resVer.data);

    if (resVer.data.msg === 'Cuenta verificada') {
        console.log('>>> TEST FINALIZADO CON EXITO: La lógica del backend funciona. <<<');
    } else {
        console.log('>>> TEST FALLIDO: La verificación falló. <<<');
    }

    process.exit(0);
};

runTest();
