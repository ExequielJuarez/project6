module.exports = (sequelize, DataTypes) => {
  const Categoria = sequelize.define("Categoria", {
    nombre: { type: DataTypes.STRING(80), allowNull: false },
    icono: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "🍽️" },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, { tableName: "categorias" });

  Categoria.associate = (db) => {
    Categoria.hasMany(db.Producto, { as: "productos", foreignKey: "categoria_id", onDelete: "CASCADE" });
  };
  return Categoria;
};
