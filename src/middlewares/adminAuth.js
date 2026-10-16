// Protege todo lo del panel: sin sesión de administrador no se ve ni se toca nada.
module.exports = (req, res, next) => {
  if (req.session && req.session.admin) return next();
  if (req.baseUrl.endsWith("/api") || req.accepts(["html", "json"]) === "json") {
    return res.status(401).json({ ok: false, mensaje: "Tu sesión venció. Volvé a ingresar." });
  }
  res.redirect(req.baseUrl);
};
