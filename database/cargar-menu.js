// Reemplaza el menú de la base por la carta real (database/menu-real.js).
//
//   npm run db:menu                          → BORRA categorías y productos actuales y carga la carta real
//   npm run db:menu -- --limpiar-pedidos     → además borra TODOS los pedidos, ventas y cajas (datos de prueba)
//
// En producción hay que agregar --si-estoy-seguro (para no borrar nada por accidente).
// Las ventas ya cobradas guardan su propia copia del nombre y precio: borrar el menú no las altera.
require("dotenv").config();
const db = require("../src/model/database/models");
const carta = require("./menu-real");

(async () => {
  const args = process.argv.slice(2);
  const limpiarPedidos = args.includes("--limpiar-pedidos");
  try {
    if (process.env.NODE_ENV === "production" && !args.includes("--si-estoy-seguro")) {
      console.error("Esto BORRA el menú actual" + (limpiarPedidos ? " y TODOS los pedidos y ventas" : "") + ". En producción agregá --si-estoy-seguro.");
      process.exit(1);
    }
    await db.sequelize.authenticate();
    await require("../src/model/database/actualizar")(db.sequelize);

    const antes = { categorias: await db.Categoria.count(), productos: await db.Producto.count(), pedidos: await db.Pedido.count() };
    console.log(`Antes: ${antes.categorias} categorías, ${antes.productos} productos, ${antes.pedidos} pedidos.`);

    await db.sequelize.transaction(async (t) => {
      await db.Producto.destroy({ where: {}, transaction: t });
      await db.Categoria.destroy({ where: {}, transaction: t });
      for (const [i, c] of carta.entries()) {
        const cat = await db.Categoria.create({ nombre: c.nombre, imagen: c.imagen || "", orden: i }, { transaction: t });
        await db.Producto.bulkCreate(
          c.productos.map((p, j) => ({ categoria_id: cat.id, nombre: p.nombre, descripcion: p.descripcion || "", precio: p.precio, costo: 0, imagen: p.imagen || "", activo: p.activo !== false, orden: j })),
          { transaction: t }
        );
      }
    });

    if (limpiarPedidos) {
      // TRUNCATE reinicia la numeración (el primer delivery vuelve a ser el #1)
      await db.sequelize.transaction(async (t) => {
        await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction: t });
        for (const tabla of ["pedido_items", "pedidos", "caja_movimientos", "caja_turnos"]) await db.sequelize.query(`TRUNCATE TABLE ${tabla}`, { transaction: t });
        await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction: t });
      });
      console.log("Pedidos, ventas y cajas de prueba borrados.");
    }

    const pausados = await db.Producto.count({ where: { activo: false } });
    console.log(`Carta cargada: ${await db.Categoria.count()} categorías y ${await db.Producto.count()} productos.`);
    if (pausados) console.log(`${pausados} productos quedaron PAUSADOS porque la carta no tiene su precio (tortas del día): ponéles precio en el panel → Menú y tildá "Disponible".`);
    await db.sequelize.close();
  } catch (e) {
    console.error("", e.message);
    process.exit(1);
  }
})();
