// Crea las tablas (si no existen) y carga un menú de ejemplo la primera vez.
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

const MENU = [
  ["☕", "Cafetería", [
    ["Café espresso", "Intenso y cremoso", 2200, 700],
    ["Cortado", "Espresso con un toque de leche", 2500, 800],
    ["Café con leche", "Taza grande, leche vaporizada", 3200, 1000],
    ["Capuchino", "Con espuma de leche y cacao", 3600, 1100],
    ["Latte", "Suave, con arte latte", 3800, 1200],
    ["Submarino", "Chocolate negro en leche caliente", 4200, 1500],
  ]],
  ["🥐", "Panificados", [
    ["Medialuna", "Manteca, al horno", 900, 300],
    ["Tostado de jamón y queso", "En pan de miga", 4500, 1700],
    ["Croissant relleno", "Jamón, queso y tomate", 4200, 1500],
  ]],
  ["🍰", "Tortas y dulces", [
    ["Cookie de chips", "Chips de chocolate", 2800, 900],
    ["Porción de torta", "Consultá los sabores del día", 5200, 1900],
    ["Brownie con dulce de leche", "Tibio, con helado", 5800, 2100],
  ]],
  ["🍔", "Hamburguesas", [
    ["Street Burger clásica", "Carne smash, cheddar, lechuga, tomate y salsa de la casa", 8900, 3500],
    ["Bacon Cheese", "Doble carne, panceta crocante y cheddar", 10900, 4400],
    ["BBQ Onion", "Carne, cebolla caramelizada y salsa barbacoa", 9900, 3900],
    ["Veggie", "Medallón de garbanzos, rúcula y tomate", 8500, 3200],
  ]],
  ["🍕", "Pizzas", [
    ["Muzzarella", "Salsa de tomate, muzzarella y aceitunas", 9500, 3300],
    ["Napolitana", "Muzzarella, tomate fresco y ajo", 10500, 3800],
    ["Fugazzeta", "Cebolla y muzzarella", 10500, 3700],
  ]],
  ["🌭", "Panchos", [
    ["Pancho clásico", "Salchicha, pan de viena y salsas", 4500, 1500],
    ["Pancho completo", "Con papas pay, cheddar y panceta", 6200, 2200],
  ]],
  ["🍟", "Papas fritas", [
    ["Papas fritas", "Porción para compartir", 5500, 1700],
    ["Papas con cheddar y panceta", "Gratinadas", 7900, 2800],
  ]],
  ["🥤", "Bebidas", [
    ["Gaseosa 500 ml", "Línea Coca-Cola", 2500, 1000],
    ["Agua mineral", "Con o sin gas", 1800, 600],
    ["Cerveza artesanal", "Pinta, consultá variedades", 5000, 2000],
    ["Limonada", "Con menta y jengibre", 3500, 900],
  ]],
];

(async () => {
  try {
    await crearBaseSiFalta();
    const db = require("../src/model/database/models");
    const reset = process.argv.includes("--reset");
    await db.sequelize.sync({ force: reset });
    await require("../src/model/database/actualizar")(db.sequelize);
    console.log(reset ? "🗑️  Tablas recreadas desde cero." : "✅ Tablas listas.");

    if (!(await db.Categoria.count())) {
      for (const [i, [icono, nombre, productos]] of MENU.entries()) {
        const cat = await db.Categoria.create({ nombre, icono, orden: i });
        await db.Producto.bulkCreate(productos.map(([n, d, precio, costo], j) => ({ categoria_id: cat.id, nombre: n, descripcion: d, precio, costo, orden: j })));
      }
      console.log("🍔 Menú de ejemplo cargado (cambialo desde /admin → Menú).");
    }
    await db.Ajuste.findOrCreate({ where: { clave: "cantidad_mesas" }, defaults: { valor: "12" } });
    await db.sequelize.close();
  } catch (e) {
    console.error("❌", e.message);
    process.exit(1);
  }
})();
