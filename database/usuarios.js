// Crea o actualiza un usuario del panel.
//   npm run db:usuarios -- <usuario> <contraseña> <admin|empleado>
// Ej: npm run db:usuarios -- admin 'MiClaveSegura' admin
//     npm run db:usuarios -- usuario 'OtraClave' empleado
// admin: ve todo. empleado: solo la pantalla de Pedidos (sin ventas, caja, menú ni ajustes).
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/model/database/models");

(async () => {
  try {
    const [nombre, clave, rol] = process.argv.slice(2);
    if (!nombre || !clave || !["admin", "empleado"].includes(rol)) {
      console.error("Uso: npm run db:usuarios -- <usuario> <contraseña> <admin|empleado>");
      process.exit(1);
    }
    if (clave.length < 8) { console.error("La contraseña debe tener al menos 8 caracteres."); process.exit(1); }
    await db.sequelize.authenticate();
    await db.Usuario.sync();
    const datos = { nombre: nombre.trim().toLowerCase(), clave_hash: await bcrypt.hash(clave, 10), rol };
    const existente = await db.Usuario.findOne({ where: { nombre: datos.nombre } });
    if (existente) await existente.update(datos); else await db.Usuario.create(datos);
    console.log(`Usuario "${datos.nombre}" ${existente ? "actualizado" : "creado"} (${rol}).`);
    await db.sequelize.close();
  } catch (e) {
    console.error("", e.message);
    process.exit(1);
  }
})();
