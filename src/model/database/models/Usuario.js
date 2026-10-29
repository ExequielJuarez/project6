// Quién puede entrar al panel. rol "admin": todo; rol "empleado": solo pedidos.
module.exports = (sequelize, DataTypes) =>
  sequelize.define("Usuario", {
    nombre: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    clave_hash: { type: DataTypes.STRING(100), allowNull: false },
    rol: { type: DataTypes.ENUM("admin", "empleado"), allowNull: false, defaultValue: "empleado" },
  }, { tableName: "usuarios" });
