// Limitador simple en memoria: máximo `max` pedidos cada `ventanaMs` por IP.
module.exports = function limitador({ max, ventanaMs, mensaje = "Demasiados intentos, esperá un momento." }) {
  const registros = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [ip, r] of registros) if (r.vence < ahora) registros.delete(ip);
  }, ventanaMs).unref();

  return (req, res, next) => {
    const ahora = Date.now();
    let r = registros.get(req.ip);
    if (!r || r.vence < ahora) registros.set(req.ip, (r = { cuenta: 0, vence: ahora + ventanaMs }));
    if (++r.cuenta > max) return res.status(429).json({ ok: false, mensaje });
    next();
  };
};
