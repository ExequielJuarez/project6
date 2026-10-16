// Código secreto de cada mesa, que viaja dentro del QR (?mesa=4&t=...).
// Sin ese código no se puede pedir "en mesa": nadie puede escribir "mesa 4" a mano.
// Se calcula con una clave del servidor (QR_SECRET o, si no está, SESSION_SECRET): no hace falta guardarlo en la base.
// OJO: si cambiás esa clave, los QR ya impresos dejan de funcionar y hay que imprimirlos de nuevo.
const crypto = require("crypto");

const clave = () => process.env.QR_SECRET || process.env.SESSION_SECRET || "street-burger-qr-desarrollo";
const tokenDeMesa = (mesa) => crypto.createHmac("sha256", clave()).update(`mesa:${Number(mesa)}`).digest("hex").slice(0, 12);

function tokenValido(mesa, token) {
  const esperado = Buffer.from(tokenDeMesa(mesa));
  const recibido = Buffer.from(String(token || ""));
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
}

module.exports = { tokenDeMesa, tokenValido };
