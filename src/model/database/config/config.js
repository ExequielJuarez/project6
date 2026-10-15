// Configuración de la base de datos (la usan Sequelize y sequelize-cli).
// Los datos de conexión salen del archivo .env (ver .env.example).
require("dotenv").config();

const base = {
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || "tienda_db",
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  dialect: "mysql",
  // Zona horaria de las fechas (Argentina por defecto). Debe coincidir con
  // el "SET time_zone" de database/datos-prueba.sql
  timezone: process.env.DB_TIMEZONE || "-03:00",
  logging: process.env.DB_LOG === "true" ? console.log : false,
  // Que los DECIMAL lleguen como número y no como texto
  dialectOptions: { decimalNumbers: true, dateStrings: false },
  define: {
    underscored: true,
    freezeTableName: true,
    createdAt: "creado_en",
    updatedAt: "actualizado_en",
  },
};

module.exports = {
  development: base,
  test: { ...base, database: process.env.DB_NAME_TEST || `${base.database}_test` },
  production: base,
};
