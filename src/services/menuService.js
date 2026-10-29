const db = require("../model/database/models");
const { ErrorNegocio, redondear } = require("../helpers/errores");

const { Categoria, Producto } = db;

// Menú para los clientes: solo lo activo
async function menuPublico() {
  return Categoria.findAll({
    where: { activo: true },
    include: [{ model: Producto, as: "productos", where: { activo: true }, required: true }],
    order: [["orden", "ASC"], ["id", "ASC"], [{ model: Producto, as: "productos" }, "orden", "ASC"], [{ model: Producto, as: "productos" }, "id", "ASC"]],
  });
}

// Menú completo para el administrador
async function menuAdmin() {
  return Categoria.findAll({
    include: [{ model: Producto, as: "productos", required: false }],
    order: [["orden", "ASC"], ["id", "ASC"], [{ model: Producto, as: "productos" }, "orden", "ASC"], [{ model: Producto, as: "productos" }, "id", "ASC"]],
  });
}

const IMAGEN_OK = /^\/(uploads|img)\/[\w.-]+$/;
function imagenValida(v) {
  const imagen = String(v || "").trim();
  if (imagen && !IMAGEN_OK.test(imagen) && !/^https?:\/\//i.test(imagen)) throw new ErrorNegocio("Imagen inválida");
  return imagen.slice(0, 255);
}

function datosCategoria(b) {
  const nombre = String(b.nombre || "").trim().slice(0, 80);
  if (!nombre) throw new ErrorNegocio("La categoría necesita un nombre");
  return { nombre, imagen: imagenValida(b.imagen), icono: "", orden: Number.parseInt(b.orden) || 0, activo: b.activo !== false };
}

function datosProducto(b) {
  const nombre = String(b.nombre || "").trim().slice(0, 120);
  const precio = Number(b.precio);
  const costo = Number(b.costo || 0);
  if (!nombre) throw new ErrorNegocio("El producto necesita un nombre");
  if (!(precio >= 0)) throw new ErrorNegocio("Poné un precio válido");
  if (!(costo >= 0)) throw new ErrorNegocio("El costo no es válido");
  const imagen = imagenValida(b.imagen);
  return {
    categoria_id: Number(b.categoria_id),
    nombre, precio: redondear(precio), costo: redondear(costo), imagen,
    descripcion: String(b.descripcion || "").trim().slice(0, 300),
    orden: Number.parseInt(b.orden) || 0,
    activo: b.activo !== false,
  };
}

const crearCategoria = (b) => Categoria.create(datosCategoria(b));
async function editarCategoria(id, b) {
  const c = await Categoria.findByPk(id);
  if (!c) throw new ErrorNegocio("Categoría inexistente", 404);
  return c.update(datosCategoria(b));
}
async function borrarCategoria(id) {
  const c = await Categoria.findByPk(id);
  if (!c) throw new ErrorNegocio("Categoría inexistente", 404);
  await c.destroy(); // borra también sus productos (las cuentas viejas guardan copia del nombre y precio)
}

async function crearProducto(b) {
  const datos = datosProducto(b);
  if (!(await Categoria.findByPk(datos.categoria_id))) throw new ErrorNegocio("Elegí una categoría");
  return Producto.create(datos);
}
async function editarProducto(id, b) {
  const p = await Producto.findByPk(id);
  if (!p) throw new ErrorNegocio("Producto inexistente", 404);
  const datos = datosProducto({ ...p.toJSON(), ...b });
  if (!(await Categoria.findByPk(datos.categoria_id))) throw new ErrorNegocio("Elegí una categoría");
  return p.update(datos);
}
async function borrarProducto(id) {
  const p = await Producto.findByPk(id);
  if (!p) throw new ErrorNegocio("Producto inexistente", 404);
  await p.destroy();
}

module.exports = { menuPublico, menuAdmin, crearCategoria, editarCategoria, borrarCategoria, crearProducto, editarProducto, borrarProducto };
