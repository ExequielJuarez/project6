const EventEmitter = require("events");
const db = require("../model/database/models");
const ajustes = require("./ajusteService");
const caja = require("./cajaService");
const { ErrorNegocio, redondear } = require("../helpers/errores");

const { Pedido, PedidoItem, Producto, Categoria, Sequelize } = db;
const { Op } = Sequelize;

// El panel de administración se entera de cambios (pedido nuevo, aviso...) por acá
const eventos = new EventEmitter();
// Solo se cobra en efectivo o por transferencia (en la base pueden quedar ventas viejas con otros métodos: se siguen mostrando)
const METODOS = ["efectivo", "transferencia"];
const PAGOS_DELIVERY = METODOS;
const MAX_POR_LINEA = 20;
const MAX_LINEAS = 40;

async function recalcular(pedido, transaction) {
  const items = await PedidoItem.findAll({ where: { pedido_id: pedido.id }, transaction });
  const subtotal = redondear(items.reduce((s, i) => s + i.precio * i.cantidad, 0));
  const costo = redondear(items.reduce((s, i) => s + i.costo * i.cantidad, 0));
  const descuento = Math.min(pedido.descuento, subtotal);
  await pedido.update({ subtotal, costo, descuento, total: redondear(subtotal - descuento + pedido.envio) }, { transaction });
}

// ---------- Armado de renglones (compartido por mesa y delivery) ----------
function limpiarLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length) throw new ErrorNegocio("El pedido está vacío");
  if (lineas.length > MAX_LINEAS) throw new ErrorNegocio("Demasiados productos en un solo pedido");
  const limpias = lineas.map((l) => ({
    productoId: Number(l.productoId),
    cantidad: Number(l.cantidad),
    nota: String(l.nota || "").trim().slice(0, 200),
  }));
  for (const l of limpias) {
    if (!Number.isInteger(l.productoId)) throw new ErrorNegocio("Producto inválido");
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > MAX_POR_LINEA) throw new ErrorNegocio(`La cantidad debe ser entre 1 y ${MAX_POR_LINEA}`);
  }
  return limpias;
}

// Crea los renglones y devuelve sus ids (para imprimir solo lo nuevo)
async function crearRenglones(pedido, limpias, origen, t) {
  const productos = await Producto.findAll({
    where: { id: limpias.map((l) => l.productoId), activo: true },
    include: [{ model: Categoria, as: "categoria", where: { activo: true }, required: true }],
    transaction: t,
  });
  const porId = new Map(productos.map((p) => [p.id, p]));
  for (const l of limpias) if (!porId.has(l.productoId)) throw new ErrorNegocio("Un producto ya no está disponible. Actualizá el menú.", 409);

  const antes = (await PedidoItem.max("id", { transaction: t })) || 0;
  await PedidoItem.bulkCreate(
    limpias.map((l) => {
      const prod = porId.get(l.productoId);
      return { pedido_id: pedido.id, producto_id: prod.id, nombre: prod.nombre, precio: prod.precio, costo: prod.costo, cantidad: l.cantidad, nota: l.nota, origen, visto: origen === "admin" };
    }),
    { transaction: t }
  );
  const nuevos = await PedidoItem.findAll({ where: { pedido_id: pedido.id, id: { [Op.gt]: antes } }, attributes: ["id"], transaction: t });
  await recalcular(pedido, t);
  return nuevos.map((i) => i.id);
}

// ---------- Mesa ----------
// Si no hay cuenta abierta, la abre. Dos celulares a la vez no la duplican.
async function agregarItems(mesa, lineas, origen, intento = 0) {
  await ajustes.validarMesa(mesa);
  const limpias = limpiarLineas(lineas);
  try {
    const { pedido, itemIds } = await db.sequelize.transaction(async (t) => {
      let p = await Pedido.findOne({ where: { mesa, estado: "abierto", tipo: "mesa" }, transaction: t, lock: t.LOCK.UPDATE });
      if (!p) p = await Pedido.create({ tipo: "mesa", mesa, mesa_abierta: mesa }, { transaction: t });
      const ids = await crearRenglones(p, limpias, origen, t);
      return { pedido: p, itemIds: ids };
    });
    eventos.emit("cambio", { tipo: origen === "cliente" ? "pedido" : "edicion", pedidoId: pedido.id, mesa, itemIds });
    return pedido;
  } catch (e) {
    // Otra persona abrió la misma mesa en el mismo instante: se reintenta
    if (e instanceof Sequelize.UniqueConstraintError && intento < 2) return agregarItems(mesa, lineas, origen, intento + 1);
    throw e;
  }
}

// ---------- Delivery ----------
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function crearDelivery(datos = {}, lineas) {
  const cfg = await ajustes.todos();
  if (!cfg.recibir_delivery) throw new ErrorNegocio("Por ahora no estamos tomando pedidos de delivery.", 409);
  const nombre = texto(datos.nombre, 60);
  const telefono = String(datos.telefono ?? "").replace(/[^\d+]/g, "").slice(0, 20);
  const direccion = texto(datos.direccion, 150);
  const referencia = texto(datos.referencia, 200);
  const pago = datos.pago;
  if (nombre.length < 2) throw new ErrorNegocio("Escribí tu nombre");
  if (telefono.replace(/\D/g, "").length < 8) throw new ErrorNegocio("Escribí tu número de WhatsApp (con código de área)");
  if (direccion.length < 5) throw new ErrorNegocio("Escribí tu dirección de entrega");
  if (!PAGOS_DELIVERY.includes(pago)) throw new ErrorNegocio("Elegí cómo vas a pagar");
  let pagoCon = null;
  if (pago === "efectivo" && datos.pagoCon !== undefined && datos.pagoCon !== "" && datos.pagoCon !== null) {
    pagoCon = Number(datos.pagoCon);
    if (!(pagoCon > 0)) throw new ErrorNegocio("Ese monto con el que abonás no es válido");
  }
  const limpias = limpiarLineas(lineas);

  const { pedido, itemIds } = await db.sequelize.transaction(async (t) => {
    const p = await Pedido.create({
      tipo: "delivery", mesa: null, mesa_abierta: null, envio: cfg.costo_envio,
      cliente_nombre: nombre, cliente_telefono: telefono, direccion, referencia: referencia || null, pago_preferido: pago, pago_con: pagoCon,
    }, { transaction: t });
    const ids = await crearRenglones(p, limpias, "cliente", t);
    if (pagoCon !== null && pagoCon < p.total) throw new ErrorNegocio(`El total es ${p.total}: indicá un monto igual o mayor con el que vas a pagar.`);
    return { pedido: p, itemIds: ids };
  });
  eventos.emit("cambio", { tipo: "pedido", delivery: true, pedidoId: pedido.id, itemIds });
  return pedido;
}

// ---------- Consultas ----------
const cargar = (where) => Pedido.findOne({ where, include: [{ model: PedidoItem, as: "items" }], order: [[{ model: PedidoItem, as: "items" }, "id", "ASC"]] });

const abiertoDeMesa = (mesa) => cargar({ mesa, estado: "abierto", tipo: "mesa" });

// Datos de la cuenta; los renglones iguales se juntan para mostrarlos/imprimirlos
function aPlano(pedido) {
  if (!pedido) return null;
  const p = pedido.toJSON();
  const grupos = new Map();
  for (const i of p.items || []) {
    const k = `${i.nombre}|${i.precio}|${i.nota}`;
    const g = grupos.get(k) || { nombre: i.nombre, precio: i.precio, nota: i.nota, cantidad: 0, subtotal: 0 };
    g.cantidad += i.cantidad;
    g.subtotal = redondear(g.subtotal + i.precio * i.cantidad);
    grupos.set(k, g);
  }
  p.resumen = [...grupos.values()];
  p.sinVer = (p.items || []).filter((i) => !i.visto).length;
  return p;
}

// Todo lo que está en pantalla: mesas abiertas y deliveries sin despachar (los más viejos primero)
async function activos() {
  const filas = await Pedido.findAll({
    where: { estado: "abierto" },
    include: [{ model: PedidoItem, as: "items" }],
    order: [["creado_en", "ASC"], ["id", "ASC"], [{ model: PedidoItem, as: "items" }, "id", "ASC"]],
  });
  return filas.map(aPlano);
}

async function pedidoAbierto(id, transaction) {
  const p = await Pedido.findByPk(id, { transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  if (!p) throw new ErrorNegocio("Ese pedido no existe", 404);
  if (p.estado !== "abierto") throw new ErrorNegocio("Ese pedido ya fue cerrado", 409);
  return p;
}

async function detalle(id) {
  const p = aPlano(await cargar({ id }));
  if (!p) throw new ErrorNegocio("Ese pedido no existe", 404);
  return p;
}

// ---------- Cambios sobre un pedido abierto ----------
async function cambiarCantidad(itemId, cantidad) {
  const cant = Number(cantidad);
  if (!Number.isInteger(cant) || cant < 0 || cant > MAX_POR_LINEA) throw new ErrorNegocio("Cantidad inválida");
  await db.sequelize.transaction(async (t) => {
    const item = await PedidoItem.findByPk(itemId, { transaction: t });
    if (!item) throw new ErrorNegocio("Ese producto ya no está en la cuenta", 404);
    const pedido = await pedidoAbierto(item.pedido_id, t);
    if (cant === 0) await item.destroy({ transaction: t });
    else await item.update({ cantidad: cant, visto: true }, { transaction: t });
    await recalcular(pedido, t);
  });
  eventos.emit("cambio", { tipo: "edicion" });
}

async function agregarAPedido(pedidoId, lineas) {
  const limpias = limpiarLineas(lineas);
  const p = await db.sequelize.transaction(async (t) => {
    const pedido = await pedidoAbierto(pedidoId, t);
    await crearRenglones(pedido, limpias, "admin", t);
    return pedido;
  });
  eventos.emit("cambio", { tipo: "edicion", pedidoId: p.id });
}

async function marcarVisto(pedidoId) {
  await PedidoItem.update({ visto: true }, { where: { pedido_id: pedidoId } });
  await Pedido.update({ aviso: "" }, { where: { id: pedidoId, estado: "abierto" } });
  eventos.emit("cambio", { tipo: "edicion" });
}

async function avisar(mesa, tipo) {
  if (!["cuenta", "mozo"].includes(tipo)) throw new ErrorNegocio("Aviso inválido");
  const p = await Pedido.findOne({ where: { mesa, estado: "abierto", tipo: "mesa" } });
  if (!p) throw new ErrorNegocio("Esa mesa todavía no tiene pedidos", 409);
  await p.update({ aviso: tipo });
  eventos.emit("cambio", { tipo: "aviso", mesa, pedidoId: p.id });
}

// Cierra una mesa (se fue el cliente) o despacha un delivery: sale de la pantalla y pasa a Ventas
async function cerrar(pedidoId, { metodo, descuento, recibido } = {}) {
  const id = await db.sequelize.transaction(async (t) => {
    const p = await pedidoAbierto(pedidoId, t);
    const turno = await caja.turnoAbierto(t); // la caja abierta es obligatoria para cobrar o despachar
    if (!turno) throw new ErrorNegocio("Primero abrí la caja para poder cobrar.", 409);
    const forma = metodo || p.pago_preferido;
    if (!METODOS.includes(forma)) throw new ErrorNegocio("Elegí cómo pagó el cliente");
    if (!(await PedidoItem.count({ where: { pedido_id: p.id }, transaction: t }))) throw new ErrorNegocio("El pedido está vacío. Cancelalo si no consumió nada.");

    if (p.tipo === "mesa") {
      await p.update({ descuento: redondear(Math.max(0, Number(descuento) || 0)) }, { transaction: t });
      await recalcular(p, t);
    }
    let cobrado = null;
    if (forma === "efectivo" && recibido !== undefined && recibido !== "" && recibido !== null) {
      cobrado = redondear(Number(recibido));
      if (!(cobrado >= p.total)) throw new ErrorNegocio("El efectivo recibido no alcanza para cubrir el total");
    }
    const ultimo = (await Pedido.max("numero_ticket", { transaction: t })) || 0;
    await p.update({ estado: "cerrado", mesa_abierta: null, metodo_pago: forma, recibido: cobrado, numero_ticket: ultimo + 1, turno_id: turno.id, cerrado_en: new Date(), aviso: "" }, { transaction: t });
    return p.id;
  });
  eventos.emit("cambio", { tipo: "cierre" });
  return detalle(id);
}

async function cancelar(pedidoId) {
  await db.sequelize.transaction(async (t) => {
    const p = await pedidoAbierto(pedidoId, t);
    await p.update({ estado: "cancelado", mesa_abierta: null, aviso: "" }, { transaction: t });
  });
  eventos.emit("cambio", { tipo: "cierre" });
}

async function historial(desde, hasta) {
  const filas = await Pedido.findAll({
    where: { estado: "cerrado", cerrado_en: { [Op.between]: [desde, hasta] } },
    order: [["cerrado_en", "DESC"]],
  });
  return filas.map((p) => p.toJSON());
}

module.exports = { eventos, agregarItems, crearDelivery, agregarAPedido, abiertoDeMesa, aPlano, activos, cambiarCantidad, marcarVisto, avisar, cerrar, cancelar, detalle, historial, METODOS };
