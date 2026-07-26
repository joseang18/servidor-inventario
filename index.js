import express from 'express';
import cors from 'cors';
import router from './routers/productoRouter.js'; // Ajusta la ruta si tu router está en otra carpeta

const app = express();
const PORT = process.env.PORT || 10000;

// Configuración de CORS para permitir peticiones del cliente
app.use(cors({
  origin: '*', // Permite conexiones desde cualquier origen (Vite / React)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Montar las rutas bajo el prefijo /api
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`🚀 Servidor de inventario corriendo en ${PORT}`);
});