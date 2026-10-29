// Panel de administración (montado en la dirección secreta ADMIN_PATH). Todo lo de /api exige sesión de administrador.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const adminAuth = require("../middlewares/adminAuth");
const { soloAdmin, rolDe } = adminAuth;
const { Usuario } = require("../model/database/models");
const limitador = require("../middlewares/limitador");
const menu = require("../services/menuService");
const ajustes = require("../services/ajusteService");
const pedidos = require("../services/pedidoService");
const caja = require("../services/cajaService");
const reportes = require("../services/reporteService");
const backup = require("../services/backupService");
const { spawn } = require("child_process");
const fechas = require("../helpers/fechas");
const { ErrorNegocio } = require("../helpers/errores");
const { tokenDeMesa } = require("../helpers/mesaToken");

const router = express.Router();
router.use((req, res, next) => { res.locals.base = req.baseUrl; next(); }); // dirección secreta, disponible en las vistas
// Los archivos del panel (JS/CSS) se sirven SOLO desde la dirección secreta: no están en la carpeta pública
router.use("/assets", express.static(path.join(__dirname, "../admin-assets")));
const limiteDescarga = limitador({ max: 12, ventanaMs: 60 * 60_000, mensaje: "Ya descargaste muchas copias seguido. Probá en un rato." });
const limiteLogin = limitador({ max: 8, ventanaMs: 15 * 60_000, mensaje: "Demasiados intentos. Probá de nuevo en 15 minutos.", soloFallos: true, responder: (req, res, mensaje) => res.status(429).render("admin/login", { configurada: true, error: mensaje }) });

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
// Devuelve { nombre, rol } si el usuario y la clave son correctos.
// Si todavía no se creó ningún usuario (npm run db:usuarios), entra "admin" con ADMIN_PASSWORD del .env.
async function autenticar(nombre, clave) {
  nombre = String(nombre || "").trim().toLowerCase();
  clave = String(clave || "");
  if (await Usuario.count()) {
    const u = await Usuario.findOne({ where: { nombre } });
    // Se compara siempre contra un hash para que no se note si el usuario existe
    const ok = await bcrypt.compare(clave, u ? u.clave_hash : "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
    return u && ok ? { nombre: u.nombre, rol: u.rol } : null;
  }
  if (nombre !== "admin") return null;
  if (process.env.ADMIN_PASSWORD_HASH) return (await bcrypt.compare(clave, process.env.ADMIN_PASSWORD_HASH)) ? { nombre, rol: "admin" } : null;
  if (process.env.ADMIN_PASSWORD && crypto.timingSafeEqual(sha(clave), sha(process.env.ADMIN_PASSWORD))) return { nombre, rol: "admin" };
  return null;
}
const claveConfigurada = async () => Boolean((await Usuario.count()) || process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD);

// ---------- Páginas ----------
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    if (rolDe(req)) return res.render("admin/panel", { rol: rolDe(req), usuario: req.session.usuario || "admin" });
    res.render("admin/login", { configurada: await claveConfigurada(), error: null });
  } catch (e) { next(e); }
});

router.post("/login", limiteLogin, async (req, res, next) => {
  try {
    if (!(await claveConfigurada())) return res.status(500).render("admin/login", { configurada: false, error: null });
    const u = await autenticar(req.body.usuario, req.body.clave);
    if (!u) return res.status(401).render("admin/login", { configurada: true, error: "Usuario o contraseña incorrectos" });
    // Se renueva el id de sesión al ingresar (evita fijación de sesión)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.admin = true;
      req.session.rol = u.rol;
      req.session.usuario = u.nombre;
      res.redirect(req.baseUrl);
    });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => req.session.destroy(() => res.redirect(req.baseUrl)));

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

// Códigos de las mesas para armar los QR (el panel arma la dirección con su propio dominio)
api.get("/qr", soloAdmin, async (req, res) => {
  const { cantidad_mesas } = await ajustes.todos();
  res.json({ ok: true, mesas: Array.from({ length: cantidad_mesas }, (_, i) => ({ mesa: i + 1, t: tokenDeMesa(i + 1) })) });
});
api.get("/ajustes", async (req, res) => res.json({ ok: true, ajustes: await ajustes.todos() }));
api.put("/ajustes", soloAdmin, async (req, res) => res.json({ ok: true, ajustes: await ajustes.guardar(req.body) }));

// Pedidos en pantalla (mesas abiertas + deliveries sin despachar)
api.get("/pedidos/activos", async (req, res) => {
  const [lista, config, turno] = await Promise.all([pedidos.activos(), ajustes.todos(), caja.turnoAbierto()]);
  res.json({ ok: true, pedidos: lista, mesas: config.cantidad_mesas, caja: Boolean(turno) });
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
api.get("/ventas", soloAdmin, async (req, res) => {
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
api.post("/categorias", soloAdmin, async (req, res) => res.json({ ok: true, categoria: await menu.crearCategoria(req.body) }));
api.put("/categorias/:id", soloAdmin, async (req, res) => res.json({ ok: true, categoria: await menu.editarCategoria(req.params.id, req.body) }));
api.delete("/categorias/:id", soloAdmin, async (req, res) => { await menu.borrarCategoria(req.params.id); res.json({ ok: true }); });
api.post("/productos", soloAdmin, async (req, res) => res.json({ ok: true, producto: await menu.crearProducto(req.body) }));
api.put("/productos/:id", soloAdmin, async (req, res) => res.json({ ok: true, producto: await menu.editarProducto(req.params.id, req.body) }));
api.delete("/productos/:id", soloAdmin, async (req, res) => { await menu.borrarProducto(req.params.id); res.json({ ok: true }); });

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const subida = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../../public/uploads"),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString("hex") + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new ErrorNegocio("Subí una imagen JPG, PNG o WEBP"))),
});
api.post("/imagenes", soloAdmin, subida.single("imagen"), (req, res) => {
  if (!req.file) throw new ErrorNegocio("No llegó ninguna imagen");
  res.json({ ok: true, url: `/uploads/${req.file.filename}` });
});

// Caja
api.get("/caja", soloAdmin, async (req, res) => res.json({ ok: true, ...(await caja.estado()) }));
api.post("/caja/abrir", soloAdmin, async (req, res) => { await caja.abrir(req.body.monto); res.json({ ok: true }); });
api.post("/caja/movimientos", soloAdmin, async (req, res) => { await caja.movimiento(req.body); res.json({ ok: true }); });
api.delete("/caja/turnos/:id", soloAdmin, async (req, res) => { await caja.borrarCierre(req.params.id); res.json({ ok: true }); });
api.post("/caja/cerrar", soloAdmin, async (req, res) => res.json({ ok: true, cierre: await caja.cerrar(req.body) }));

// Copias de seguridad (se descargan desde Ajustes). Contienen datos de clientes: tratarlas como privadas.
api.get("/backup/base", soloAdmin, limiteDescarga, async (req, res) => {
  const gz = await backup.generarGz();
  res.set({ "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${backup.nombreArchivo("street-burger-base", "sql.gz")}"`, "Content-Length": gz.length });
  res.send(gz);
});
// Fotos subidas desde el panel (public/uploads) en un .tar.gz
api.get("/backup/fotos", soloAdmin, limiteDescarga, (req, res, next) => {
  const carpeta = path.join(__dirname, "../../public/uploads");
  const tar = spawn("tar", ["-czf", "-", "-C", carpeta, "--exclude=.gitkeep", "."]);
  let fallo = "";
  tar.stderr.on("data", (d) => (fallo += d));
  tar.on("error", () => next(new ErrorNegocio("Este servidor no puede armar el archivo de fotos. Copiá la carpeta public/uploads por SFTP.", 500)));
  res.set({ "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${backup.nombreArchivo("street-burger-fotos", "tar.gz")}"` });
  tar.stdout.pipe(res);
  tar.on("close", (c) => { if (c !== 0 && !res.headersSent) next(new ErrorNegocio("No se pudo armar el archivo de fotos. " + fallo.slice(0, 100), 500)); });
});

// Ganancias
api.get("/reportes", soloAdmin, async (req, res) => res.json({ ok: true, ...(await reportes.reporte(req.query.grupo, req.query.clave)) }));

router.use("/api", api);
module.exports = router;
