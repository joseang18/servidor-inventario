import express from 'express';
import cors from 'cors';
import router from './routers/productoRouter.js';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Montamos el router tanto con el prefijo /api como directamente en la raíz
app.use('/api', router);
app.use('/', router); // 👈 Esto permite que funcione tanto /api/opciones como /opciones

app.listen(PORT, () => {
  console.log(`🚀 Servidor de inventario corriendo en el puerto ${PORT}`);
});