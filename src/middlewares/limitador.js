// Limitador simple en memoria: máximo `max` pedidos cada `ventanaMs` por IP.
// Con `soloFallos: true` solo cuentan las respuestas con error (ideal para el login:
// entrar bien muchas veces no te bloquea, equivocarte la clave muchas veces sí).
module.exports = function limitador({ max, ventanaMs, mensaje = "Demasiados intentos, esperá un momento.", soloFallos = false, responder }) {
  const registros = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [ip, r] of registros) if (r.vence < ahora) registros.delete(ip);
  }, ventanaMs).unref();

  return (req, res, next) => {
    const ahora = Date.now();
    let r = registros.get(req.ip);
    if (!r || r.vence < ahora) registros.set(req.ip, (r = { cuenta: 0, vence: ahora + ventanaMs }));
    if (r.cuenta >= max) return responder ? responder(req, res, mensaje) : res.status(429).json({ ok: false, mensaje });
    if (soloFallos) res.on("finish", () => { if (res.statusCode >= 400) r.cuenta++; });
    else r.cuenta++;
    next();
  };
};
