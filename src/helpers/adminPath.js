// Dirección secreta del panel de administración (ADMIN_PATH en el .env).
// En desarrollo es /admin. En producción es OBLIGATORIO poner una propia y difícil de adivinar.
const crypto = require("crypto");

let ruta = (process.env.ADMIN_PATH || "/admin").trim();
if (!ruta.startsWith("/")) ruta = "/" + ruta;
ruta = ruta.replace(/\/+$/, "");

const OBVIAS = ["admin", "administrador", "administrator", "panel", "login", "dashboard", "gestion", "backoffice", "wp-admin", "manager", "api", "img", "css", "js", "uploads", "salud"];

// Devuelve los problemas de la dirección (lista vacía = está bien)
function problemas(produccion) {
  const errores = [];
  if (!/^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(ruta)) errores.push("ADMIN_PATH solo puede tener letras, números, guiones y barras (ejemplo: /panel-7f3a9c2e1b8d).");
  if (produccion) {
    const sinBarras = ruta.replace(/\//g, "");
    if (!process.env.ADMIN_PATH) errores.push("Falta ADMIN_PATH: la dirección secreta del panel.");
    else if (OBVIAS.includes(ruta.slice(1).toLowerCase()) || sinBarras.length < 12) errores.push("ADMIN_PATH es muy fácil de adivinar: usá una dirección larga y rara (mínimo 12 caracteres).");
  }
  return errores;
}

const sugerencia = () => "/panel-" + crypto.randomBytes(8).toString("hex");

module.exports = { ADMIN_PATH: ruta, problemasAdminPath: problemas, sugerenciaAdminPath: sugerencia };
