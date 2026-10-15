const { Ajuste } = require("../model/database/models");
const { ErrorNegocio } = require("../helpers/errores");

const DEFECTOS = {
  nombre_local: "Street Burger",
  cantidad_mesas: "12",
  recibir_pedidos: "1",
};

async function todos() {
  const filas = await Ajuste.findAll();
  const out = { ...DEFECTOS };
  filas.forEach((f) => (out[f.clave] = f.valor));
  return {
    nombre_local: out.nombre_local,
    cantidad_mesas: Number(out.cantidad_mesas),
    recibir_pedidos: out.recibir_pedidos === "1",
  };
}

async function guardar({ nombre_local, cantidad_mesas, recibir_pedidos }) {
  const mesas = Number(cantidad_mesas);
  if (!Number.isInteger(mesas) || mesas < 1 || mesas > 100) throw new ErrorNegocio("La cantidad de mesas debe ser entre 1 y 100");
  const nombre = String(nombre_local || "").trim().slice(0, 60);
  if (!nombre) throw new ErrorNegocio("Poné el nombre del local");
  const pares = { nombre_local: nombre, cantidad_mesas: String(mesas), recibir_pedidos: recibir_pedidos ? "1" : "0" };
  for (const [clave, valor] of Object.entries(pares)) await Ajuste.upsert({ clave, valor });
  return todos();
}

async function validarMesa(mesa) {
  const { cantidad_mesas } = await todos();
  if (!Number.isInteger(mesa) || mesa < 1 || mesa > cantidad_mesas) throw new ErrorNegocio("Esa mesa no existe");
}

module.exports = { todos, guardar, validarMesa };
