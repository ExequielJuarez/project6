module.exports = (sequelize, DataTypes) => {
  const Producto = sequelize.define("Producto", {
    categoria_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    descripcion: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    // Costo opcional: permite calcular la ganancia real (ventas - costo)
    costo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    imagen: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { tableName: "productos" });

  Producto.associate = (db) => {
    Producto.belongsTo(db.Categoria, { as: "categoria", foreignKey: "categoria_id" });
  };
  return Producto;
};
