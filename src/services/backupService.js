// Copia de seguridad de la base de datos generada por el propio sitio (no hace falta mysqldump ni la consola).
// Produce un archivo .sql estándar: se restaura con  mysql -u USUARIO -p BASE < copia.sql
const zlib = require("zlib");
const { sequelize } = require("../model/database/models");

const EXCLUIDAS = new Set(["sesiones"]); // sesiones de login: no se guardan
const LOTE = 200;
const q = (n) => "`" + String(n).replace(/`/g, "``") + "`";

async function generarSql() {
  const [filas] = await sequelize.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tablas = filas.map((f) => Object.values(f)[0]).filter((t) => !EXCLUIDAS.has(t)).sort();
  const salida = [
    `-- Copia de seguridad de Street Burger · ${new Date().toISOString()}`,
    "-- Restaurar:  mysql -u USUARIO -p BASE < esta_copia.sql   (reemplaza las tablas incluidas)",
    "SET NAMES utf8mb4;", "SET FOREIGN_KEY_CHECKS = 0;", "",
  ];
  for (const t of tablas) {
    const [[crear]] = await sequelize.query(`SHOW CREATE TABLE ${q(t)}`);
    salida.push(`DROP TABLE IF EXISTS ${q(t)};`, crear["Create Table"] + ";");
    const [datos] = await sequelize.query(`SELECT * FROM ${q(t)}`);
    if (datos.length) {
      const columnas = Object.keys(datos[0]).map(q).join(", ");
      for (let i = 0; i < datos.length; i += LOTE) {
        const valores = datos.slice(i, i + LOTE).map((fila) => "(" + Object.values(fila).map((v) => sequelize.escape(v)).join(", ") + ")");
        salida.push(`INSERT INTO ${q(t)} (${columnas}) VALUES\n${valores.join(",\n")};`);
      }
    }
    salida.push("");
  }
  salida.push("SET FOREIGN_KEY_CHECKS = 1;", "");
  return { sql: salida.join("\n"), tablas };
}

async function generarGz() {
  const { sql } = await generarSql();
  return zlib.gzipSync(Buffer.from(sql, "utf8"));
}

const nombreArchivo = (prefijo, ext) => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${prefijo}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
};

module.exports = { generarSql, generarGz, nombreArchivo };
