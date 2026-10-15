// Error "esperable" (dato inválido, caja cerrada...) con el código HTTP a devolver
class ErrorNegocio extends Error {
  constructor(mensaje, status = 400) { super(mensaje); this.status = status; }
}
const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
module.exports = { ErrorNegocio, redondear };
