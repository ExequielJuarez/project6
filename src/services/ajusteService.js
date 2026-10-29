const { Ajuste } = require("../model/database/models");
const { ErrorNegocio } = require("../helpers/errores");

const DEFECTOS = {
  nombre_local: "Street Burger",
  cantidad_mesas: "12",
  recibir_pedidos: "1",
  recibir_delivery: "1",
  costo_envio: "0",
  transferencia_info: "",
  direccion_local: "",
  tiempo_estimado: "30-45 min",
  halloween: "1",
};

function armar(filas) {
  const out = { ...DEFECTOS };
  filas.forEach((f) => (out[f.clave] = f.valor));
  return {
    nombre_local: out.nombre_local,
    cantidad_mesas: Number(out.cantidad_mesas),
    recibir_pedidos: out.recibir_pedidos === "1",
    recibir_delivery: out.recibir_delivery === "1",
    costo_envio: Number(out.costo_envio) || 0,
    transferencia_info: out.transferencia_info,
    direccion_local: out.direccion_local,
    tiempo_estimado: out.tiempo_estimado,
    halloween: out.halloween === "1",
  };
}

const todos = async () => armar(await Ajuste.findAll());

async function guardar(b) {
  const mesas = Number(b.cantidad_mesas);
  if (!Number.isInteger(mesas) || mesas < 1 || mesas > 100) throw new ErrorNegocio("La cantidad de mesas debe ser entre 1 y 100");
  const nombre = String(b.nombre_local || "").trim().slice(0, 60);
  if (!nombre) throw new ErrorNegocio("Poné el nombre del local");
  const envio = Number(b.costo_envio || 0);
  if (!(envio >= 0)) throw new ErrorNegocio("El costo de envío no es válido");
  const pares = {
    nombre_local: nombre,
    cantidad_mesas: String(mesas),
    recibir_pedidos: b.recibir_pedidos ? "1" : "0",
    recibir_delivery: b.recibir_delivery ? "1" : "0",
    costo_envio: String(Math.round(envio * 100) / 100),
    transferencia_info: String(b.transferencia_info || "").trim().slice(0, 300),
    direccion_local: String(b.direccion_local || "").trim().slice(0, 120),
    tiempo_estimado: String(b.tiempo_estimado || "").trim().slice(0, 20),
    halloween: b.halloween ? "1" : "0",
  };
  for (const [clave, valor] of Object.entries(pares)) await Ajuste.upsert({ clave, valor });
  return todos();
}

async function validarMesa(mesa) {
  const { cantidad_mesas } = await todos();
  if (!Number.isInteger(mesa) || mesa < 1 || mesa > cantidad_mesas) throw new ErrorNegocio("Esa mesa no existe");
}

module.exports = { todos, guardar, validarMesa };
