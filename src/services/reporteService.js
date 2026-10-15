const db = require("../model/database/models");
const f = require("../helpers/fechas");
const { redondear } = require("../helpers/errores");

const { Pedido, PedidoItem, Sequelize } = db;
const CANTIDAD = { dia: 14, semana: 12, mes: 12 };
const GRUPOS = Object.keys(CANTIDAD);

const vacio = () => ({ ventas: 0, ganancia: 0, pedidos: 0, descuentos: 0 });
function sumar(acc, p) {
  acc.ventas += p.total; acc.ganancia += p.total - p.costo; acc.pedidos += 1; acc.descuentos += p.descuento;
  return acc;
}
const cerrarNumeros = (a) => ({ ...a, ventas: redondear(a.ventas), ganancia: redondear(a.ganancia), descuentos: redondear(a.descuentos), ticketPromedio: a.pedidos ? redondear(a.ventas / a.pedidos) : 0 });

// grupo: dia | semana | mes · clave: período a detallar (por defecto el actual)
async function reporte(grupo = "dia", clave) {
  if (!GRUPOS.includes(grupo)) grupo = "dia";
  const hoy = f.claveDia(new Date());
  const periodos = f.ultimosPeriodos(grupo, hoy, CANTIDAD[grupo]);
  const elegido = periodos.includes(clave) ? clave : periodos[periodos.length - 1];

  // Se traen los pedidos desde el período más viejo (o el inicio del mes/semana actual, para el resumen)
  const inicioSerie = periodos[0].length === 7 ? `${periodos[0]}-01` : periodos[0];
  const desde = f.desdeFecha([inicioSerie, `${f.claveMes(hoy)}-01`, f.claveSemana(hoy)].sort()[0]);
  const pedidos = await Pedido.findAll({ where: { estado: "cerrado", cerrado_en: { [Sequelize.Op.gte]: desde } } });
  const datos = pedidos.map((p) => ({ p, dia: f.claveDia(p.cerrado_en) }));

  const serie = periodos.map((k) => {
    const a = vacio();
    datos.filter((d) => f.claveSegun(grupo, d.dia) === k).forEach((d) => sumar(a, d.p));
    return { clave: k, etiqueta: f.etiqueta(grupo, k), ...cerrarNumeros(a) };
  });

  const resumen = {};
  for (const [nombre, g] of [["hoy", "dia"], ["semana", "semana"], ["mes", "mes"]]) {
    const k = f.claveSegun(g, hoy);
    const a = vacio();
    datos.filter((d) => f.claveSegun(g, d.dia) === k).forEach((d) => sumar(a, d.p));
    resumen[nombre] = cerrarNumeros(a);
  }

  // Detalle del período elegido: métodos de pago y productos más vendidos
  const delPeriodo = datos.filter((d) => f.claveSegun(grupo, d.dia) === elegido).map((d) => d.p);
  const porMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0, mercadopago: 0 };
  delPeriodo.forEach((p) => (porMetodo[p.metodo_pago] += p.total));
  const items = delPeriodo.length ? await PedidoItem.findAll({ where: { pedido_id: delPeriodo.map((p) => p.id) } }) : [];
  const top = new Map();
  items.forEach((i) => {
    const t = top.get(i.nombre) || { nombre: i.nombre, cantidad: 0, total: 0 };
    t.cantidad += i.cantidad; t.total = redondear(t.total + i.precio * i.cantidad);
    top.set(i.nombre, t);
  });
  const acumulado = vacio();
  delPeriodo.forEach((p) => sumar(acumulado, p));

  return {
    grupo, resumen, serie, clave: elegido, etiquetaClave: f.etiqueta(grupo, elegido),
    detalle: {
      ...cerrarNumeros(acumulado),
      porMetodo: Object.fromEntries(Object.entries(porMetodo).map(([k, v]) => [k, redondear(v)])),
      top: [...top.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10),
    },
    // Si ningún producto tiene costo cargado, "ganancia" = ventas
    hayCostos: (await db.Producto.count({ where: { costo: { [Sequelize.Op.gt]: 0 } } })) > 0,
  };
}

module.exports = { reporte };
