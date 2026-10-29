// Protege todo lo del panel: sin sesión no se ve ni se toca nada.
// Las sesiones anteriores a los roles (sin "rol") eran del administrador.
const rolDe = (req) => (req.session && req.session.admin ? req.session.rol || "admin" : null);

const adminAuth = (req, res, next) => {
  if (rolDe(req)) return next();
  if (req.baseUrl.endsWith("/api") || req.accepts(["html", "json"]) === "json") {
    return res.status(401).json({ ok: false, mensaje: "Tu sesión venció. Volvé a ingresar." });
  }
  res.redirect(req.baseUrl);
};
// Solo el administrador: ventas, caja, menú (editar), ajustes, QR, copias de seguridad
adminAuth.soloAdmin = (req, res, next) => {
  if (rolDe(req) === "admin") return next();
  res.status(403).json({ ok: false, mensaje: "No tenés permiso para esto." });
};
adminAuth.rolDe = rolDe;
module.exports = adminAuth;
