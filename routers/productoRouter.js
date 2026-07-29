import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const router = Router();
const prisma = new PrismaClient();

// Obtener todas las opciones generales (Categorías, Subcategorías, Proveedores, Tipos)
router.get('/opciones', async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany();
    const subcategorias = await prisma.subcategoria.findMany({
      include: { categoria: true }
    });
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { id: 'asc' }
    });
    const tiposProducto = await prisma.tipoProducto.findMany();

    res.json({
      success: true,
      categorias,
      subcategorias,
      proveedores,
      tiposProducto
    });
  } catch (error) {
    console.error('Error al cargar opciones:', error);
    res.status(500).json({ success: false, error: 'Error al obtener datos del servidor' });
  }
});

// --- GESTIÓN DE TIPOS DE PRODUCTO ---

router.get('/tipos', async (req, res) => {
  try {
    const tipos = await prisma.tipoProducto.findMany();
    res.json({ success: true, tipos });
  } catch (error) {
    console.error('Error al obtener tipos de producto:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los tipos de producto' });
  }
});

router.post('/tipos', async (req, res) => {
  try {
    const { nombre, codigo } = req.body;
    if (!nombre || !codigo) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
    }
    const nuevoTipo = await prisma.tipoProducto.create({
      data: {
        nombre: nombre.trim(),
        codigo: codigo.toUpperCase().trim()
      }
    });
    res.json({ success: true, tipo: nuevoTipo });
  } catch (error) {
    console.error('Error al crear tipo de producto:', error);
    res.status(500).json({ success: false, error: 'Error al guardar el tipo de producto' });
  }
});

// --- GESTIÓN DE PROVEEDORES ---

router.get('/proveedores', async (req, res) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { id: 'asc' }
    });
    res.json({ success: true, proveedores });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los proveedores' });
  }
});

router.post('/proveedores', async (req, res) => {
  try {
    const { nombre, nit, contacto, porcentajeUtilidad, porcentajeMayor, comentario } = req.body;
    if (!nombre || !nit) {
      return res.status(400).json({ success: false, error: 'El nombre de la empresa y el NIT son obligatorios.' });
    }
    const nuevoProveedor = await prisma.proveedor.create({
      data: {
        nombre: nombre.trim(),
        nit: nit.trim(),
        contacto: contacto ? contacto.trim() : null,
        porcentajeUtilidad: porcentajeUtilidad ? parseFloat(porcentajeUtilidad) : 35,
        porcentajeMayor: porcentajeMayor ? parseFloat(porcentajeMayor) : 20,
        comentario: comentario ? comentario.trim() : null
      }
    });
    res.json({ success: true, proveedor: nuevoProveedor });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ success: false, error: 'Error al guardar el proveedor (es posible que el NIT ya esté registrado).' });
  }
});

// --- GESTIÓN DE CATEGORÍAS ---

router.post('/categorias', async (req, res) => {
  try {
    const { nombre, codigo } = req.body;
    if (!nombre || !codigo) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
    }
    const nuevaCategoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        codigo: codigo.toUpperCase().trim()
      }
    });
    res.json({ success: true, categoria: nuevaCategoria });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ success: false, error: 'Error al guardar la categoría' });
  }
});

// --- GESTIÓN DE SUBCATEGORÍAS ---

router.post('/subcategorias', async (req, res) => {
  try {
    const { nombre, categoriaId, codigo } = req.body;
    if (!nombre || !categoriaId) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
    }
    const codigoGenerado = codigo ? codigo.toUpperCase().slice(0, 2) : nombre.trim().toUpperCase().slice(0, 2);
    const nuevaSubcategoria = await prisma.subcategoria.create({
      data: {
        nombre: nombre.trim(),
        categoriaId: Number(categoriaId),
        codigo: codigoGenerado
      }
    });
    res.json({ success: true, subcategoria: nuevaSubcategoria });
  } catch (error) {
    console.error('Error al crear subcategoría:', error);
    res.status(500).json({ success: false, error: 'Error al guardar la subcategoría en la base de datos' });
  }
});

// --- GESTIÓN DE PRODUCTOS (LISTADO Y BÚSQUEDA) ---

// 1. Obtener todos los productos (Endpoint agregado para evitar Cannot GET /api/productos)
router.get('/productos', async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      include: {
        categoria: true,
        subcategoria: true,
        proveedor: true,
        tipoProducto: true
      },
      orderBy: { id: 'desc' }
    });
    res.json({ success: true, productos });
  } catch (error) {
    console.error('Error al obtener la lista de productos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los productos del servidor.' });
  }
});

// 2. Buscar producto por código SKU exacto (Flexible: ignora mayúsculas y espacios)
router.get('/productos/sku/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const producto = await prisma.producto.findFirst({
      where: {
        sku: {
          equals: sku.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (!producto) {
      return res.status(404).json({ success: false, error: 'No encontrado' });
    }
    res.json(producto);
  } catch (error) {
    console.error('Error al buscar por SKU:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Buscar coincidencias por nombre en la tabla productos (Estilo LIKE)
router.get('/productos/buscar', async (req, res) => {
  try {
    const { nombre } = req.query;
    const productos = await prisma.producto.findMany({
      where: {
        nombre: {
          contains: nombre || '',
          mode: 'insensitive',
        },
      },
    });
    res.json(productos);
  } catch (error) {
    console.error('Error al buscar productos por nombre:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- VALIDACIÓN DE PRODUCTO DUPLICADO ---
router.post('/productos/verificar-duplicado', async (req, res) => {
  try {
    const { tipoProductoId, categoriaId, subcategoriaId, atributo, nombre } = req.body;

    if (!nombre || !categoriaId) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios para la validación.' });
    }

    const productoExistente = await prisma.producto.findFirst({
      where: {
        categoriaId: Number(categoriaId),
        subcategoriaId: subcategoriaId ? Number(subcategoriaId) : null,
        tipoProductoId: tipoProductoId ? Number(tipoProductoId) : null,
        atributo: atributo ? atributo.trim().toUpperCase() : null,
        nombre: {
          equals: nombre.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (productoExistente) {
      return res.json({
        duplicado: true,
        error: `El producto ya existe en la base de datos con el SKU: ${productoExistente.sku}`
      });
    }

    res.json({ duplicado: false });
  } catch (error) {
    console.error('Error al verificar duplicidad:', error);
    res.status(500).json({ success: false, error: 'Error al validar el producto en el servidor.' });
  }
});

// --- GESTIÓN DE PRODUCTOS (REGISTRO COMPLETO) ---
router.post('/productos', async (req, res) => {
  try {
    const {
      sku,
      nombre,
      tipoProductoId,
      categoriaId,
      subcategoriaId,
      proveedorId,
      atributo,
      costoBase,
      flete,
      porcentajeDescuento,
      porcentajeIva,
      costoTotal,
      precioDetal,
      precioMayor
    } = req.body;
    
    if (!sku || !nombre || !categoriaId || !proveedorId || !costoBase) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios (SKU, nombre, categoría, proveedor o costo base).' });
    }

    const skuLimpio = sku.trim().toUpperCase();

    const existeSku = await prisma.producto.findUnique({
      where: { sku: skuLimpio }
    });

    if (existeSku) {
      return res.status(400).json({
        success: false,
        error: `El código SKU "${skuLimpio}" ya se encuentra registrado. Por favor, genere uno nuevo.`
      });
    }

    const nuevoProducto = await prisma.producto.create({
      data: {
        sku: skuLimpio,
        nombre: nombre.trim(),
        tipoProductoId: tipoProductoId ? Number(tipoProductoId) : null,
        categoriaId: Number(categoriaId),
        subcategoriaId: subcategoriaId ? Number(subcategoriaId) : null,
        proveedorId: Number(proveedorId),
        atributo: atributo ? atributo.trim().toUpperCase() : null,
        costoBase: parseFloat(costoBase),
        flete: flete ? parseFloat(flete) : 0,
        porcentajeDescuento: porcentajeDescuento ? parseFloat(porcentajeDescuento) : 0,
        porcentajeIva: porcentajeIva ? parseFloat(porcentajeIva) : 0,
        costoTotal: costoTotal ? parseFloat(costoTotal) : 0,
        precioDetal: precioDetal ? parseFloat(precioDetal) : 0,
        precioMayor: precioMayor ? parseFloat(precioMayor) : 0
      }
    });

    res.json({ success: true, producto: nuevoProducto });
  } catch (error) {
    console.error('Error al registrar producto:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al registrar el producto en la base de datos.' });
  }
});

// --- ACTUALIZAR PRODUCTO ---
router.put('/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nombre, 
      proveedorId, 
      costoBase, 
      flete, 
      porcentajeDescuento, 
      porcentajeIva, 
      costoTotal, 
      precioDetal, 
      precioMayor 
    } = req.body;

    const productoActualizado = await prisma.producto.update({
      where: { id: Number(id) },
      data: {
        ...(nombre && { nombre: nombre.trim() }),
        ...(proveedorId && {
          proveedor: {
            connect: { id: Number(proveedorId) }
          }
        }),
        costoBase: costoBase !== undefined && costoBase !== '' ? parseFloat(costoBase) : undefined,
        flete: flete !== undefined && flete !== '' ? parseFloat(flete) : undefined,
        porcentajeDescuento: porcentajeDescuento !== undefined && !isNaN(porcentajeDescuento) && porcentajeDescuento !== '' ? parseFloat(porcentajeDescuento) : 0,
        porcentajeIva: porcentajeIva !== undefined && !isNaN(porcentajeIva) && porcentajeIva !== '' ? parseFloat(porcentajeIva) : 0,
        costoTotal: costoTotal !== undefined && !isNaN(costoTotal) ? parseFloat(costoTotal) : undefined,
        precioDetal: precioDetal !== undefined && !isNaN(precioDetal) ? parseFloat(precioDetal) : undefined,
        precioMayor: precioMayor !== undefined && !isNaN(precioMayor) ? parseFloat(precioMayor) : undefined,
      }
    });

    res.json({ success: true, message: 'Producto actualizado exitosamente', producto: productoActualizado });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- IMPRESIÓN DIRECTA CON BARTENDER (VÍA LÍNEA DE COMANDOS CLI) ---
router.post('/imprimir-bartender', async (req, res) => {
  try {
    const { sku, nombre, precioDetal, precioMayor, copias } = req.body;

    if (!sku) {
      return res.status(400).json({ success: false, error: 'SKU requerido para imprimir' });
    }

    const numeroCopias = parseInt(copias, 10) || 1;

    const carpetaTemporal = 'C:\\EtiquetasBarTender';
    if (!fs.existsSync(carpetaTemporal)) {
      fs.mkdirSync(carpetaTemporal, { recursive: true });
    }

    const csvPath = path.join(carpetaTemporal, 'TempDatos.csv');
    const contenidoCsv = `SKU,NOMBRE,PRECIO_DETAL,PRECIO_MAYOR\n"${sku}","${nombre || ''}","${precioDetal || 0}","${precioMayor || 0}"`;
    fs.writeFileSync(csvPath, contenidoCsv, 'utf8');

    const bartenderPath = `"C:\\Program Files\\Seagull\\BarTender 2022\\bartend.exe"`;
    const plantillaPath = `"C:\\EtiquetasBarTender\\etiqueta_producto.btw"`;

    const comando = `${bartenderPath} /F=${plantillaPath} /C=${numeroCopias} /P /X /MIN=Y`;

    exec(comando, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al ejecutar BarTender CLI: ${error.message}`);
        console.error(`stderr:`, stderr);
        return res.status(500).json({ success: false, error: 'Error al enviar la orden a la impresora.' });
      }

      return res.json({ success: true, message: '¡Orden de impresión directa enviada con éxito!' });
    });

  } catch (error) {
    console.error('Error al generar impresión directa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- GENERACIÓN DINÁMICA DE SKU CON SOPORTE FLEXIBLE PARA EL NOMBRE ---
router.get('/generar-sku', async (req, res) => {
  try {
    console.log("Query recibido en /generar-sku:", req.query);

    const { tipoProductoId, categoriaId, subcategoriaId, atributo } = req.query;
    const nombre = req.query.nombre || req.query.nombreProducto || req.query.q;

    if (!categoriaId) {
      return res.status(400).json({ success: false, error: 'La categoría es obligatoria para generar el SKU.' });
    }

    if (!nombre || String(nombre).trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe ingresar el nombre del producto antes de generar el SKU.' 
      });
    }

    const productoExistente = await prisma.producto.findFirst({
      where: {
        categoriaId: Number(categoriaId),
        subcategoriaId: subcategoriaId ? Number(subcategoriaId) : null,
        tipoProductoId: tipoProductoId ? Number(tipoProductoId) : null,
        atributo: atributo ? String(atributo).trim().toUpperCase() : null,
        nombre: {
          equals: String(nombre).trim(),
          mode: 'insensitive'
        }
      }
    });

    if (productoExistente) {
      return res.status(400).json({
        success: false,
        error: `El producto ya existe en la base de datos con el SKU: ${productoExistente.sku}`
      });
    }

    let partesSku = [];

    if (tipoProductoId) {
      const tipo = await prisma.tipoProducto.findUnique({
        where: { id: Number(tipoProductoId) }
      });
      if (tipo && tipo.codigo) {
        partesSku.push(tipo.codigo.trim().toUpperCase().slice(0, 1));
      }
    }

    const categoria = await prisma.categoria.findUnique({
      where: { id: Number(categoriaId) }
    });
    if (!categoria) {
      return res.status(404).json({ success: false, error: 'Categoría no encontrada.' });
    }
    partesSku.push(categoria.codigo.trim().toUpperCase().slice(0, 3));

    let subcategoriaIdNum = null;
    if (subcategoriaId) {
      subcategoriaIdNum = Number(subcategoriaId);
      const sub = await prisma.subcategoria.findUnique({
        where: { id: subcategoriaIdNum }
      });
      if (sub && sub.codigo) {
        partesSku.push(sub.codigo.trim().toUpperCase().slice(0, 2));
      }
    }

    if (atributo) {
      partesSku.push(String(atributo).trim().toUpperCase().slice(0, 2));
    }

    const filtroConteo = {
      categoriaId: Number(categoriaId)
    };
    if (subcategoriaIdNum) {
      filtroConteo.subcategoriaId = subcategoriaIdNum;
    }

    const conteoExistentes = await prisma.producto.count({
      where: filtroConteo
    });
    const correlativo = String(conteoExistentes + 1).padStart(3, '0');
    partesSku.push(correlativo);

    const skuGenerado = partesSku.join('');

    res.json({ 
      success: true, 
      sku: skuGenerado 
    });
  } catch (error) {
    console.error('Error al generar SKU:', error);
    res.status(500).json({ success: false, error: 'Error al generar el SKU en el servidor' });
  }
});

export default router;