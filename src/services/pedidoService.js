const EventEmitter = require("events");
const db = require("../model/database/models");
const ajustes = require("./ajusteService");
const caja = require("./cajaService");
const { ErrorNegocio, redondear } = require("../helpers/errores");

const { Pedido, PedidoItem, Producto, Categoria, Sequelize } = db;
const { Op } = Sequelize;

// El panel de administración se entera de cambios (pedido nuevo, aviso...) por acá
const eventos = new EventEmitter();
const METODOS = ["efectivo", "tarjeta", "transferencia", "mercadopago"];
const MAX_POR_LINEA = 20;
const MAX_LINEAS = 40;

async function recalcular(pedido, transaction) {
  const items = await PedidoItem.findAll({ where: { pedido_id: pedido.id }, transaction });
  const subtotal = redondear(items.reduce((s, i) => s + i.precio * i.cantidad, 0));
  const costo = redondear(items.reduce((s, i) => s + i.costo * i.cantidad, 0));
  const descuento = Math.min(pedido.descuento, subtotal);
  await pedido.update({ subtotal, costo, descuento, total: redondear(subtotal - descuento) }, { transaction });
}

// Pedidos de una mesa: si no hay cuenta abierta, la abre. Dos celulares a la vez no la duplican.
async function agregarItems(mesa, lineas, origen, intento = 0) {
  await ajustes.validarMesa(mesa);
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

  try {
    const pedido = await db.sequelize.transaction(async (t) => {
      const productos = await Producto.findAll({
        where: { id: limpias.map((l) => l.productoId), activo: true },
        include: [{ model: Categoria, as: "categoria", where: { activo: true }, required: true }],
        transaction: t,
      });
      const porId = new Map(productos.map((p) => [p.id, p]));
      for (const l of limpias) if (!porId.has(l.productoId)) throw new ErrorNegocio("Un producto ya no está disponible. Actualizá el menú.", 409);

      let p = await Pedido.findOne({ where: { mesa, estado: "abierto" }, transaction: t, lock: t.LOCK.UPDATE });
      if (!p) p = await Pedido.create({ mesa, mesa_abierta: mesa }, { transaction: t });

      await PedidoItem.bulkCreate(
        limpias.map((l) => {
          const prod = porId.get(l.productoId);
          return { pedido_id: p.id, producto_id: prod.id, nombre: prod.nombre, precio: prod.precio, costo: prod.costo, cantidad: l.cantidad, nota: l.nota, origen, visto: origen === "admin" };
        }),
        { transaction: t }
      );
      await recalcular(p, t);
      return p;
    });
    eventos.emit("cambio", { tipo: origen === "cliente" ? "pedido" : "edicion", mesa });
    return pedido;
  } catch (e) {
    // Otra persona abrió la misma mesa en el mismo instante: se reintenta una vez
    if (e instanceof Sequelize.UniqueConstraintError && intento < 2) return agregarItems(mesa, lineas, origen, intento + 1);
    throw e;
  }
}

const cargar = (where) => Pedido.findOne({ where, include: [{ model: PedidoItem, as: "items" }], order: [[{ model: PedidoItem, as: "items" }, "id", "ASC"]] });

async function abiertoDeMesa(mesa) {
  return cargar({ mesa, estado: "abierto" });
}

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

async function mesas() {
  const { cantidad_mesas } = await ajustes.todos();
  const abiertos = await Pedido.findAll({ where: { estado: "abierto" }, include: [{ model: PedidoItem, as: "items", attributes: ["id", "cantidad", "visto"] }] });
  const porMesa = new Map(abiertos.map((p) => [p.mesa, p]));
  const lista = [];
  for (let n = 1; n <= Math.max(cantidad_mesas, ...abiertos.map((p) => p.mesa)); n++) {
    const p = porMesa.get(n);
    lista.push({
      mesa: n,
      fueraDeRango: n > cantidad_mesas,
      pedidoId: p?.id ?? null,
      total: p?.total ?? 0,
      productos: p ? p.items.reduce((s, i) => s + i.cantidad, 0) : 0,
      sinVer: p ? p.items.filter((i) => !i.visto).length : 0,
      aviso: p?.aviso ?? "",
      desde: p?.creado_en ?? null,
    });
  }
  return lista;
}

async function pedidoAbierto(id, transaction) {
  const p = await Pedido.findByPk(id, { transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  if (!p) throw new ErrorNegocio("Ese pedido no existe", 404);
  if (p.estado !== "abierto") throw new ErrorNegocio("Esa mesa ya fue cerrada", 409);
  return p;
}

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

async function marcarVisto(pedidoId) {
  await PedidoItem.update({ visto: true }, { where: { pedido_id: pedidoId } });
  await Pedido.update({ aviso: "" }, { where: { id: pedidoId, estado: "abierto" } });
}

async function avisar(mesa, tipo) {
  if (!["cuenta", "mozo"].includes(tipo)) throw new ErrorNegocio("Aviso inválido");
  const p = await Pedido.findOne({ where: { mesa, estado: "abierto" } });
  if (!p) throw new ErrorNegocio("Esa mesa todavía no tiene pedidos", 409);
  await p.update({ aviso: tipo });
  eventos.emit("cambio", { tipo: "aviso", mesa });
}

async function aplicarDescuento(pedidoId, descuento) {
  const d = Number(descuento) || 0;
  if (d < 0) throw new ErrorNegocio("El descuento no puede ser negativo");
  await db.sequelize.transaction(async (t) => {
    const p = await pedidoAbierto(pedidoId, t);
    await p.update({ descuento: redondear(d) }, { transaction: t });
    await recalcular(p, t);
  });
}

async function cerrar(pedidoId, { metodo, descuento, recibido }) {
  if (!METODOS.includes(metodo)) throw new ErrorNegocio("Elegí cómo pagó el cliente");
  const id = await db.sequelize.transaction(async (t) => {
    const p = await pedidoAbierto(pedidoId, t);
    if (!(await PedidoItem.count({ where: { pedido_id: p.id }, transaction: t }))) throw new ErrorNegocio("La cuenta está vacía. Cancelá el pedido si no consumió nada.");
    const turno = await caja.turnoAbierto(t);
    if (!turno) throw new ErrorNegocio("Abrí la caja antes de cobrar (pestaña Caja)", 409);

    await p.update({ descuento: redondear(Math.max(0, Number(descuento) || 0)) }, { transaction: t });
    await recalcular(p, t);
    const total = p.total;
    let cobrado = null;
    if (metodo === "efectivo" && recibido !== undefined && recibido !== "" && recibido !== null) {
      cobrado = redondear(Number(recibido));
      if (!(cobrado >= total)) throw new ErrorNegocio("El efectivo recibido no alcanza para cubrir el total");
    }
    const ultimo = (await Pedido.max("numero_ticket", { transaction: t })) || 0;
    await p.update({ estado: "cerrado", mesa_abierta: null, metodo_pago: metodo, recibido: cobrado, numero_ticket: ultimo + 1, turno_id: turno.id, cerrado_en: new Date(), aviso: "" }, { transaction: t });
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

async function detalle(id) {
  const p = aPlano(await cargar({ id }));
  if (!p) throw new ErrorNegocio("Ese pedido no existe", 404);
  return p;
}

async function historial(desde, hasta) {
  const filas = await Pedido.findAll({
    where: { estado: "cerrado", cerrado_en: { [Op.between]: [desde, hasta] } },
    order: [["cerrado_en", "DESC"]],
  });
  return filas.map((p) => p.toJSON());
}

module.exports = { eventos, agregarItems, abiertoDeMesa, aPlano, mesas, cambiarCantidad, marcarVisto, avisar, aplicarDescuento, cerrar, cancelar, detalle, historial, METODOS };
