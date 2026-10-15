// Ajustes sueltos del local (cantidad de mesas, si se reciben pedidos, etc.)
module.exports = (sequelize, DataTypes) =>
  sequelize.define("Ajuste", {
    clave: { type: DataTypes.STRING(60), primaryKey: true },
    valor: { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: "ajustes" });
