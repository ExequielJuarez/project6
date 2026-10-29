// Deja la base "desde cero" para empezar a trabajar de verdad:
// BORRA todos los pedidos, ventas y cajas (movimientos y cierres) y reinicia la numeración.
// NO toca el menú (categorías y productos) ni los ajustes (mesas, transferencia, envío...).
//
//   npm run db:limpiar -- --si-estoy-seguro
require("dotenv").config();
const db = require("../src/model/database/models");

(async () => {
  try {
    if (!process.argv.includes("--si-estoy-seguro")) {
      console.error("Esto BORRA todos los pedidos, ventas y cajas (no toca el menú ni los ajustes).\n   Para confirmar, ejecutalo con:  npm run db:limpiar -- --si-estoy-seguro");
      process.exit(1);
    }
    await db.sequelize.authenticate();
    const antes = { pedidos: await db.Pedido.count(), items: await db.PedidoItem.count(), turnos: await db.CajaTurno.count(), movimientos: await db.CajaMovimiento.count() };
    await db.sequelize.transaction(async (t) => {
      await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction: t });
      for (const tabla of ["pedido_items", "pedidos", "caja_movimientos", "caja_turnos"]) await db.sequelize.query(`TRUNCATE TABLE ${tabla}`, { transaction: t });
      await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction: t });
    });
    console.log(`Borrado: ${antes.pedidos} pedidos (${antes.items} renglones), ${antes.turnos} cajas y ${antes.movimientos} movimientos.`);
    console.log(`Quedó el menú: ${await db.Categoria.count()} categorías y ${await db.Producto.count()} productos. Todo listo para empezar de cero.`);
    await db.sequelize.close();
  } catch (e) {
    console.error("", e.message);
    process.exit(1);
  }
})();
