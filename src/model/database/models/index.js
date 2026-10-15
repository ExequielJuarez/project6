// Carga todos los modelos de esta carpeta y arma las relaciones.
const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");

const entorno = process.env.NODE_ENV || "development";
const config = require("../config/config")[entorno];

const sequelize = new Sequelize(config.database, config.username, config.password, config);
const db = { sequelize, Sequelize };

fs.readdirSync(__dirname)
  .filter((f) => f !== "index.js" && f.endsWith(".js"))
  .forEach((f) => {
    const modelo = require(path.join(__dirname, f))(sequelize, DataTypes);
    db[modelo.name] = modelo;
  });

Object.values(db).forEach((m) => m.associate && m.associate(db));

module.exports = db;
