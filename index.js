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
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`🚀 Servidor de inventario corriendo en el puerto ${PORT}`);
});