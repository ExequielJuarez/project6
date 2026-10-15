// Un turno de caja: se abre con un monto inicial y se cierra contando el efectivo.
module.exports = (sequelize, DataTypes) => {
  const CajaTurno = sequelize.define("CajaTurno", {
    monto_inicial: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    cerrado_en: { type: DataTypes.DATE, allowNull: true },
    monto_esperado: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    monto_contado: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    nota: { type: DataTypes.STRING(250), allowNull: false, defaultValue: "" },
  }, { tableName: "caja_turnos" });

  CajaTurno.associate = (db) => {
    CajaTurno.hasMany(db.CajaMovimiento, { as: "movimientos", foreignKey: "turno_id", onDelete: "CASCADE" });
  };
  return CajaTurno;
};
