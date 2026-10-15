const db = require("../model/database/models");
const { ErrorNegocio, redondear } = require("../helpers/errores");

const { CajaTurno, CajaMovimiento, Pedido } = db;

const turnoAbierto = (transaction) => CajaTurno.findOne({ where: { cerrado_en: null }, order: [["id", "DESC"]], transaction });

// Números de un turno: ventas por método, movimientos y efectivo que debería haber
async function resumen(turno) {
  const [pedidos, movs] = await Promise.all([
    Pedido.findAll({ where: { turno_id: turno.id, estado: "cerrado" } }),
    CajaMovimiento.findAll({ where: { turno_id: turno.id }, order: [["id", "DESC"]] }),
  ]);
  const ventas = { efectivo: 0, tarjeta: 0, transferencia: 0, mercadopago: 0 };
  pedidos.forEach((p) => (ventas[p.metodo_pago] += p.total));
  const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const egresos = movs.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);
  const totalVentas = Object.values(ventas).reduce((s, n) => s + n, 0);
  const esperado = redondear(turno.monto_inicial + ventas.efectivo + ingresos - egresos);
  return {
    turno: turno.toJSON(),
    pedidos: pedidos.length,
    ventas: Object.fromEntries(Object.entries(ventas).map(([k, v]) => [k, redondear(v)])),
    totalVentas: redondear(totalVentas),
    ingresos: redondear(ingresos),
    egresos: redondear(egresos),
    esperado,
    movimientos: movs.map((m) => m.toJSON()),
  };
}

async function estado() {
  const turno = await turnoAbierto();
  const anteriores = await CajaTurno.findAll({ where: { cerrado_en: { [db.Sequelize.Op.ne]: null } }, order: [["id", "DESC"]], limit: 15 });
  const historial = [];
  for (const t of anteriores) {
    const r = await resumen(t);
    historial.push({ ...t.toJSON(), totalVentas: r.totalVentas, diferencia: redondear(t.monto_contado - t.monto_esperado) });
  }
  return { actual: turno ? await resumen(turno) : null, historial };
}

async function abrir(montoInicial) {
  const monto = Number(montoInicial);
  if (!(monto >= 0)) throw new ErrorNegocio("Ingresá con cuánto efectivo abrís la caja");
  if (await turnoAbierto()) throw new ErrorNegocio("La caja ya está abierta", 409);
  return CajaTurno.create({ monto_inicial: redondear(monto) });
}

async function movimiento({ tipo, monto, concepto }) {
  const turno = await turnoAbierto();
  if (!turno) throw new ErrorNegocio("Abrí la caja primero", 409);
  const m = Number(monto);
  if (!["ingreso", "egreso"].includes(tipo)) throw new ErrorNegocio("Tipo de movimiento inválido");
  if (!(m > 0)) throw new ErrorNegocio("El monto debe ser mayor a 0");
  const texto = String(concepto || "").trim().slice(0, 150);
  if (!texto) throw new ErrorNegocio("Contá de qué es el movimiento");
  return CajaMovimiento.create({ turno_id: turno.id, tipo, monto: redondear(m), concepto: texto });
}

async function cerrar({ contado, nota }) {
  const turno = await turnoAbierto();
  if (!turno) throw new ErrorNegocio("No hay una caja abierta", 409);
  const abiertas = await Pedido.count({ where: { estado: "abierto" } });
  if (abiertas) throw new ErrorNegocio(`Todavía hay ${abiertas} mesa(s) sin cobrar. Cobralas o cancelalas antes de cerrar la caja.`, 409);
  const c = Number(contado);
  if (!(c >= 0)) throw new ErrorNegocio("Ingresá el efectivo que contaste");
  const r = await resumen(turno);
  await turno.update({ cerrado_en: new Date(), monto_esperado: r.esperado, monto_contado: redondear(c), nota: String(nota || "").trim().slice(0, 250) });
  return { ...r, turno: turno.toJSON(), diferencia: redondear(c - r.esperado) };
}

module.exports = { turnoAbierto, estado, abrir, movimiento, cerrar };
