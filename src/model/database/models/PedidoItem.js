// Renglón de una cuenta. Guarda copia del nombre/precio/costo del momento,
// así cambiar el menú después no altera cuentas ni reportes viejos.
module.exports = (sequelize, DataTypes) => {
  const PedidoItem = sequelize.define("PedidoItem", {
    pedido_id: { type: DataTypes.INTEGER, allowNull: false },
    producto_id: { type: DataTypes.INTEGER, allowNull: true },
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    costo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    nota: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    origen: { type: DataTypes.ENUM("cliente", "admin"), allowNull: false, defaultValue: "cliente" },
    // false = el administrador todavía no lo vio (aparece como "NUEVO")
    visto: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: "pedido_items" });
  return PedidoItem;
};
