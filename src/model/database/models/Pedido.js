// Una cuenta de mesa. Mientras está "abierto" se le pueden seguir agregando cosas.
module.exports = (sequelize, DataTypes) => {
  const Pedido = sequelize.define("Pedido", {
    mesa: { type: DataTypes.INTEGER, allowNull: false },
    // = mesa mientras el pedido está abierto, NULL cuando se cierra.
    // El índice único garantiza UNA sola cuenta abierta por mesa.
    mesa_abierta: { type: DataTypes.INTEGER, allowNull: true, unique: "una_cuenta_abierta_por_mesa" },
    estado: { type: DataTypes.ENUM("abierto", "cerrado", "cancelado"), allowNull: false, defaultValue: "abierto" },
    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    descuento: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    costo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    metodo_pago: { type: DataTypes.ENUM("efectivo", "tarjeta", "transferencia", "mercadopago"), allowNull: true },
    recibido: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    numero_ticket: { type: DataTypes.INTEGER, allowNull: true },
    turno_id: { type: DataTypes.INTEGER, allowNull: true },
    cerrado_en: { type: DataTypes.DATE, allowNull: true },
    // Avisos del cliente: "cuenta" (pide la cuenta) o "mozo"
    aviso: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "" },
  }, { tableName: "pedidos" });

  Pedido.associate = (db) => {
    Pedido.hasMany(db.PedidoItem, { as: "items", foreignKey: "pedido_id", onDelete: "CASCADE" });
    Pedido.belongsTo(db.CajaTurno, { as: "turno", foreignKey: "turno_id" });
  };
  return Pedido;
};
