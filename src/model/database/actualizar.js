// Si la base es de una versión anterior, agrega lo que falte (no borra nada).
// Se ejecuta al arrancar el servidor y en `npm run db:instalar`.
const { DataTypes } = require("sequelize");

const COLUMNAS_PEDIDOS = {
  tipo: { type: DataTypes.ENUM("mesa", "delivery"), allowNull: false, defaultValue: "mesa" },
  cliente_nombre: { type: DataTypes.STRING(60), allowNull: true },
  cliente_telefono: { type: DataTypes.STRING(20), allowNull: true },
  direccion: { type: DataTypes.STRING(150), allowNull: true },
  referencia: { type: DataTypes.STRING(200), allowNull: true },
  pago_preferido: { type: DataTypes.ENUM("efectivo", "transferencia", "tarjeta"), allowNull: true },
  pago_con: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  envio: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
};

// Fotos de ejemplo según el nombre de la categoría (se aplican UNA vez, al agregar la columna)
const FOTOS_CATEGORIA = [
  [/caf[eé]/i, "/img/cafe.webp"],
  [/panific|medialuna/i, "/img/medialunas.webp"],
  [/hamburg|burger/i, "/img/hamburguesa.webp"],
  [/pizza/i, "/img/pizza.webp"],
  [/pancho|hot ?dog/i, "/img/pancho.webp"],
  [/papa/i, "/img/papas-fritas.webp"],
];

async function agregarImagenCategorias(sequelize, qi) {
  let cols;
  try { cols = await qi.describeTable("categorias"); } catch { return; }
  if (cols.imagen) return;
  await qi.addColumn("categorias", "imagen", { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" });
  console.log("🔧 Base actualizada: categorias.imagen");
  const [categorias] = await sequelize.query("SELECT id, nombre FROM categorias");
  for (const c of categorias) {
    const foto = FOTOS_CATEGORIA.find(([re]) => re.test(c.nombre));
    if (foto) await sequelize.query("UPDATE categorias SET imagen = ? WHERE id = ?", { replacements: [foto[1], c.id] });
  }
  await sequelize.query("UPDATE productos SET imagen = '/img/bebida-coca-cola.webp' WHERE imagen = '' AND nombre REGEXP 'gaseosa|coca'");
  console.log("🖼️  Fotos de ejemplo asignadas a las categorías");
}

module.exports = async function actualizar(sequelize) {
  const qi = sequelize.getQueryInterface();
  await sequelize.models.Usuario.sync(); // tabla de usuarios del panel (crea solo si falta)
  let cols;
  try { cols = await qi.describeTable("pedidos"); } catch { return; } // todavía no hay tablas: las crea db:instalar
  for (const [nombre, def] of Object.entries(COLUMNAS_PEDIDOS)) {
    if (!cols[nombre]) { await qi.addColumn("pedidos", nombre, def); console.log(`🔧 Base actualizada: pedidos.${nombre}`); }
  }
  await agregarImagenCategorias(sequelize, qi);
  // Los delivery no tienen número de mesa
  if (cols.mesa && cols.mesa.allowNull === false) {
    await qi.changeColumn("pedidos", "mesa", { type: DataTypes.INTEGER, allowNull: true });
    console.log("🔧 Base actualizada: pedidos.mesa admite vacío");
  }
};
