require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");

const db = require("./model/database/models");
const indexRouter = require("./routes/index.Routes");
const adminRouter = require("./routes/admin.Routes");
const { ADMIN_PATH, problemasAdminPath, sugerenciaAdminPath } = require("./helpers/adminPath");
const limitador = require("./middlewares/limitador");

// La dirección secreta del panel se valida SIEMPRE (en producción, además, es obligatoria y tiene que ser difícil de adivinar)
const erroresPanel = problemasAdminPath(process.env.NODE_ENV === "production");
if (erroresPanel.length) {
  console.error("❌ Problema con la dirección del panel (ADMIN_PATH en el archivo .env):\n   - " + erroresPanel.join("\n   - ") + `\n   Por ejemplo: ADMIN_PATH=${sugerenciaAdminPath()}`);
  process.exit(1);
}

const app = express();
const puerto = process.env.PORT || 3000;

if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY);
fs.mkdirSync(path.join(__dirname, "../public/uploads"), { recursive: true });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" });
  next();
});
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "100kb" }));

const secreto = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) console.warn("⚠️  Definí SESSION_SECRET en el .env (si no, el panel te pide la clave de nuevo cada vez que se reinicia el servidor).");
app.use(
  session({
    name: "sb_admin",
    secret: secreto,
    resave: false,
    saveUninitialized: false,
    cookie: { path: ADMIN_PATH, httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE === "true", maxAge: 12 * 3600e3 },
  }),
);

// Helpers disponibles en las vistas
app.locals.formatoPrecio = (n) => "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

app.use(ADMIN_PATH, adminRouter);
app.use("/", indexRouter);

// Quien anda probando direcciones (buscando el panel) se queda sin respuestas un rato
const frenoExploradores = limitador({ max: 30, ventanaMs: 10 * 60_000, mensaje: "Demasiados intentos. Esperá unos minutos." });
const esApiAdmin = (req) => req.originalUrl.startsWith(`${ADMIN_PATH}/api/`);

// (favicon y similares no cuentan: en un local todos los clientes comparten la misma IP del wifi)
const inofensivo = /^\/(favicon\.ico|apple-touch-icon.*|robots\.txt)$/;
app.use((req, res, next) => (inofensivo.test(req.path) ? next() : frenoExploradores(req, res, next)), (req, res) => {
  if (req.path.startsWith("/api/") || esApiAdmin(req)) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
  res.status(404).send("<h1>Página no encontrada</h1><p><a href='/'>Ir al menú</a></p>");
});

// Errores: los "esperables" (ErrorNegocio) muestran su mensaje; el resto se registra
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let mensaje = err.message;
  if (err.name === "MulterError") status = 400, mensaje = err.code === "LIMIT_FILE_SIZE" ? "La imagen pesa más de 5 MB" : "No se pudo subir la imagen";
  else if (err.type === "entity.parse.failed") status = 400, mensaje = "Datos inválidos";
  else if (!err.status) {
    console.error("❌", err);
    mensaje = "Error del servidor, probá de nuevo";
  }
  if (req.path.startsWith("/api/") || esApiAdmin(req) || req.accepts(["html", "json"]) === "json") {
    return res.status(status).json({ ok: false, mensaje });
  }
  res.status(status).send(`<h1>Algo salió mal</h1><p>${status >= 500 ? "Probá de nuevo en unos minutos." : mensaje}</p>`);
});

db.sequelize
  .authenticate()
  .then(() => require("./model/database/actualizar")(db.sequelize))
  .then(() => {
    console.log(`✅ Conectado a la base de datos "${db.sequelize.config.database}"`);
    if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) console.warn("⚠️  Definí ADMIN_PASSWORD en el .env para poder entrar a /admin.");
    app.listen(puerto, () => console.log(`🚀 Servidor corriendo en http://localhost:${puerto}  (panel: ${ADMIN_PATH})`));
  })
  .catch((error) => {
    console.error("❌ No se pudo conectar con la base de datos:", error.message);
    console.error("   Revisá DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en el .env y que MySQL esté encendido.");
    console.error("   Para crear las tablas y cargar el menú de ejemplo: npm run db:instalar");
    process.exit(1);
  });
