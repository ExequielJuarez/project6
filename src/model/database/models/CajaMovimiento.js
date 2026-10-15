// Plata que entra o sale de la caja fuera de las ventas (compras, retiros, etc.)
module.exports = (sequelize, DataTypes) =>
  sequelize.define("CajaMovimiento", {
    turno_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.ENUM("ingreso", "egreso"), allowNull: false },
    monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    concepto: { type: DataTypes.STRING(150), allowNull: false },
  }, { tableName: "caja_movimientos" });
