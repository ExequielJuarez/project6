require("dotenv").config();
const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const session = require("express-session");

const app = express();

const indexRouter = require("./routes/index.Routes");
const adminRouter = require("./routes/admin.Routes");
const db = require("./model/database/models");
const carritoService = require("./services/carritoService");
const favoritoService = require("./services/favoritoService");

const puerto = 3000;

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: "Secreto_FichaTecnica_123",
    resave: false,
    saveUninitialized: false,
  }),
);

// Helpers disponibles en todas las vistas
app.locals.formatoPrecio = (n) =>
  "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
app.locals.descuentoTransferencia = 0.1;
// Estado de un pedido explicado para el cliente (Mis pedidos)
Object.assign(app.locals, require("./helpers/situacionPedido"));
// Textos editables del inicio: *palabra* → cursiva (ya escapado)
app.locals.textoRico = require("./services/inicioService").textoRico;
// $4,7 M · $865 mil · $950 (para tarjetas y ejes del panel)
app.locals.formatoCompacto = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3).toLocaleString("es-AR")} mil`;
  return `$${Math.round(n).toLocaleString("es-AR")}`;
};
app.locals.formatoPorcentaje = (n) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
app.locals.formatoFecha = (fecha, conHora = false) =>
  new Date(fecha).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use(async (req, res, next) => {
  res.locals.usuarioLocal = req.session.usuarioLogueado || null;
  res.locals.cantidadCarrito = carritoService.cantidadTotal(req.session);
  res.locals.favoritosIds = await favoritoService.ids(req.session);

  // Mensaje de un solo uso (se muestra como aviso y se borra)
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.use("/admin", adminRouter);
app.use("/", indexRouter);

// Error inesperado (por ejemplo, se cayó la base de datos)
app.use((err, req, res, next) => {
  console.error("❌", err);
  if (req.accepts(["html", "json"]) === "json") {
    return res.status(500).json({ ok: false, mensaje: "Error del servidor, probá de nuevo" });
  }
  res.status(500).send("<h1>Algo salió mal</h1><p>Probá de nuevo en unos minutos.</p>");
});

// Arranca solo si hay conexión con la base de datos
db.sequelize
  .authenticate()
  // Si la base es de una versión anterior, agrega lo que falte (no borra nada)
  .then(() => require("./model/database/actualizar")())
  .then(() => {
    console.log(`✅ Conectado a la base de datos "${db.sequelize.config.database}"`);
    app.listen(puerto, () => console.log(`🚀 Servidor Express corriendo en el puerto ${puerto}`));
    // Pagos: modo y vencimiento de los pedidos con tarjeta que no se pagaron
    const pagos = require("./services/pagoService");
    console.log(
      pagos.modo() === "demo"
        ? "💳 Pagos en MODO DEMO (no se cobra). Configurá MP_ACCESS_TOKEN en .env para cobrar con Mercado Pago."
        : `💳 Pagos con Mercado Pago${pagos.esTokenDePrueba() ? " (credenciales de PRUEBA)" : ""}`
    );
    pagos.vencerPeriodicamente();
  })
  .catch((error) => {
    console.error("❌ No se pudo conectar con la base de datos:", error.message);
    console.error("   Revisá DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en el .env y que MySQL esté encendido.");
    console.error("   Para crear las tablas y cargar datos de prueba: npm run db:instalar");
    process.exit(1);
  });
