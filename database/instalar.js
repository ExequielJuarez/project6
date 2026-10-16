// Crea las tablas (si no existen) y carga la carta real la primera vez.
//   npm run db:instalar            → crea tablas y, si el menú está vacío, lo carga
//   npm run db:instalar -- --reset → BORRA todo y vuelve a empezar (¡cuidado!)
require("dotenv").config();
const mysql = require("mysql2/promise");
const config = require("../src/model/database/config/config")[process.env.NODE_ENV || "development"];

// Crea la base de datos si todavía no existe (hace falta un usuario con permiso para crearla)
async function crearBaseSiFalta() {
  const conexion = await mysql.createConnection({ host: config.host, port: config.port, user: config.username, password: config.password });
  await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, "")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conexion.end();
}

const carta = require("./menu-real");

(async () => {
  try {
    await crearBaseSiFalta();
    const db = require("../src/model/database/models");
    const reset = process.argv.includes("--reset");
    await db.sequelize.sync({ force: reset });
    await require("../src/model/database/actualizar")(db.sequelize);
    console.log(reset ? "🗑️  Tablas recreadas desde cero." : "✅ Tablas listas.");

    if (!(await db.Categoria.count())) {
      for (const [i, c] of carta.entries()) {
        const cat = await db.Categoria.create({ nombre: c.nombre, icono: c.icono, imagen: c.imagen || "", orden: i });
        await db.Producto.bulkCreate(c.productos.map((p, j) => ({ categoria_id: cat.id, nombre: p.nombre, descripcion: p.descripcion || "", precio: p.precio, costo: 0, imagen: p.imagen || "", activo: p.activo !== false, orden: j })));
      }
      console.log("🍔 Carta real cargada (cambiala desde /admin → Menú).");
    }
    await db.Ajuste.findOrCreate({ where: { clave: "cantidad_mesas" }, defaults: { valor: "12" } });
    await db.sequelize.close();
  } catch (e) {
    console.error("❌", e.message);
    process.exit(1);
  }
})();
