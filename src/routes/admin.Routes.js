// Panel de administración. Todo lo de /admin/api exige sesión de administrador.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const adminAuth = require("../middlewares/adminAuth");
const limitador = require("../middlewares/limitador");
const menu = require("../services/menuService");
const ajustes = require("../services/ajusteService");
const pedidos = require("../services/pedidoService");
const caja = require("../services/cajaService");
const reportes = require("../services/reporteService");
const fechas = require("../helpers/fechas");
const { ErrorNegocio } = require("../helpers/errores");

const router = express.Router();
const limiteLogin = limitador({ max: 8, ventanaMs: 15 * 60_000, mensaje: "Demasiados intentos. Probá de nuevo en 15 minutos.", soloFallos: true, responder: (req, res, mensaje) => res.status(429).render("admin/login", { configurada: true, error: mensaje }) });

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
async function claveCorrecta(intento) {
  if (process.env.ADMIN_PASSWORD_HASH) return bcrypt.compare(String(intento), process.env.ADMIN_PASSWORD_HASH);
  if (process.env.ADMIN_PASSWORD) return crypto.timingSafeEqual(sha(intento), sha(process.env.ADMIN_PASSWORD));
  return false;
}
const claveConfigurada = () => Boolean(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD);

// ---------- Páginas ----------
router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.session.admin) return res.render("admin/panel");
  res.render("admin/login", { configurada: claveConfigurada(), error: null });
});

router.post("/login", limiteLogin, async (req, res, next) => {
  try {
    if (!claveConfigurada()) return res.status(500).render("admin/login", { configurada: false, error: null });
    if (!(await claveCorrecta(req.body.clave))) {
      return res.status(401).render("admin/login", { configurada: true, error: "Contraseña incorrecta" });
    }
    // Se renueva el id de sesión al ingresar (evita fijación de sesión)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.admin = true;
      res.redirect("/admin");
    });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => req.session.destroy(() => res.redirect("/admin")));

// ---------- API ----------
const api = express.Router();
api.use(adminAuth);
api.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

// Aviso en vivo al panel: llega un pedido, piden la cuenta, etc. (Server-Sent Events)
api.get("/eventos", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  const enviar = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  pedidos.eventos.on("cambio", enviar);
  const latido = setInterval(() => res.write(": latido\n\n"), 25_000);
  req.on("close", () => { clearInterval(latido); pedidos.eventos.off("cambio", enviar); });
});

api.get("/ajustes", async (req, res) => res.json({ ok: true, ajustes: await ajustes.todos() }));
api.put("/ajustes", async (req, res) => res.json({ ok: true, ajustes: await ajustes.guardar(req.body) }));

// Pedidos en pantalla (mesas abiertas + deliveries sin despachar)
api.get("/pedidos/activos", async (req, res) => {
  const [lista, config] = await Promise.all([pedidos.activos(), ajustes.todos()]);
  res.json({ ok: true, pedidos: lista, mesas: config.cantidad_mesas });
});
api.post("/mesas/:mesa/items", async (req, res) => {
  const p = await pedidos.agregarItems(Number(req.params.mesa), req.body.items, "admin");
  res.json({ ok: true, pedido: await pedidos.detalle(p.id) });
});
api.post("/pedidos/:id/items", async (req, res) => {
  await pedidos.agregarAPedido(req.params.id, req.body.items);
  res.json({ ok: true, pedido: await pedidos.detalle(req.params.id) });
});
api.patch("/items/:id", async (req, res) => { await pedidos.cambiarCantidad(req.params.id, req.body.cantidad); res.json({ ok: true }); });
api.post("/pedidos/:id/visto", async (req, res) => { await pedidos.marcarVisto(req.params.id); res.json({ ok: true }); });
api.post("/pedidos/:id/cerrar", async (req, res) => res.json({ ok: true, pedido: await pedidos.cerrar(req.params.id, req.body) }));
api.post("/pedidos/:id/cancelar", async (req, res) => { await pedidos.cancelar(req.params.id); res.json({ ok: true }); });
api.get("/pedidos/:id", async (req, res) => res.json({ ok: true, pedido: await pedidos.detalle(req.params.id) }));

// Ventas: lo cobrado/despachado de un día (?dia=YYYY-MM-DD, por defecto hoy) + totales de hoy, semana y mes
api.get("/ventas", async (req, res) => {
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dia || "") ? req.query.dia : fechas.claveDia(new Date());
  const desde = fechas.desdeInicioDia(dia);
  const hasta = new Date(desde.getTime() + 24 * 3600e3 - 1);
  const [lista, rep] = await Promise.all([pedidos.historial(desde, hasta), reportes.reporte("dia")]);
  const porMetodo = {};
  let total = 0;
  lista.forEach((p) => { porMetodo[p.metodo_pago] = (porMetodo[p.metodo_pago] || 0) + p.total; total += p.total; });
  res.json({ ok: true, dia, pedidos: lista, total, porMetodo, resumen: rep.resumen });
});

// Menú
api.get("/menu", async (req, res) => res.json({ ok: true, categorias: await menu.menuAdmin() }));
api.post("/categorias", async (req, res) => res.json({ ok: true, categoria: await menu.crearCategoria(req.body) }));
api.put("/categorias/:id", async (req, res) => res.json({ ok: true, categoria: await menu.editarCategoria(req.params.id, req.body) }));
api.delete("/categorias/:id", async (req, res) => { await menu.borrarCategoria(req.params.id); res.json({ ok: true }); });
api.post("/productos", async (req, res) => res.json({ ok: true, producto: await menu.crearProducto(req.body) }));
api.put("/productos/:id", async (req, res) => res.json({ ok: true, producto: await menu.editarProducto(req.params.id, req.body) }));
api.delete("/productos/:id", async (req, res) => { await menu.borrarProducto(req.params.id); res.json({ ok: true }); });

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const subida = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../../public/uploads"),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString("hex") + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new ErrorNegocio("Subí una imagen JPG, PNG o WEBP"))),
});
api.post("/imagenes", subida.single("imagen"), (req, res) => {
  if (!req.file) throw new ErrorNegocio("No llegó ninguna imagen");
  res.json({ ok: true, url: `/uploads/${req.file.filename}` });
});

// Caja
api.get("/caja", async (req, res) => res.json({ ok: true, ...(await caja.estado()) }));
api.post("/caja/abrir", async (req, res) => { await caja.abrir(req.body.monto); res.json({ ok: true }); });
api.post("/caja/movimientos", async (req, res) => { await caja.movimiento(req.body); res.json({ ok: true }); });
api.post("/caja/cerrar", async (req, res) => res.json({ ok: true, cierre: await caja.cerrar(req.body) }));

// Ganancias
api.get("/reportes", async (req, res) => res.json({ ok: true, ...(await reportes.reporte(req.query.grupo, req.query.clave)) }));

router.use("/api", api);
module.exports = router;
