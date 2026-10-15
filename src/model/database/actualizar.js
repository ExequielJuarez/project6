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

module.exports = async function actualizar(sequelize) {
  const qi = sequelize.getQueryInterface();
  let cols;
  try { cols = await qi.describeTable("pedidos"); } catch { return; } // todavía no hay tablas: las crea db:instalar
  for (const [nombre, def] of Object.entries(COLUMNAS_PEDIDOS)) {
    if (!cols[nombre]) { await qi.addColumn("pedidos", nombre, def); console.log(`🔧 Base actualizada: pedidos.${nombre}`); }
  }
  // Los delivery no tienen número de mesa
  if (cols.mesa && cols.mesa.allowNull === false) {
    await qi.changeColumn("pedidos", "mesa", { type: DataTypes.INTEGER, allowNull: true });
    console.log("🔧 Base actualizada: pedidos.mesa admite vacío");
  }
};
