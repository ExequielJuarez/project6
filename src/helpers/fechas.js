// Fechas "de negocio": un bar que cierra a la 1 am no quiere que esas ventas
// cuenten como el día siguiente, así que el día empieza a las 5 am (hora local).
const ZONA = process.env.TZ_LOCAL || "America/Argentina/Buenos_Aires";
const HORA_CORTE = Number(process.env.HORA_CORTE_DIA ?? 5);

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const claveDia = (fecha) => formatoDia.format(new Date(new Date(fecha).getTime() - HORA_CORTE * 3600e3));
const aUTC = (clave) => { const [y, m, d] = clave.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const deUTC = (dt) => dt.toISOString().slice(0, 10);
const sumarDias = (clave, n) => { const dt = aUTC(clave); dt.setUTCDate(dt.getUTCDate() + n); return deUTC(dt); };
const claveSemana = (clave) => sumarDias(clave, -((aUTC(clave).getUTCDay() + 6) % 7)); // lunes
const claveMes = (clave) => clave.slice(0, 7);

const claveSegun = (grupo, clave) => (grupo === "semana" ? claveSemana(clave) : grupo === "mes" ? claveMes(clave) : clave);

// Últimos N períodos (el más viejo primero) terminando en el actual
function ultimosPeriodos(grupo, hoy, n) {
  const claves = [];
  if (grupo === "mes") {
    let [y, m] = hoy.split("-").map(Number);
    for (let i = 0; i < n; i++) { claves.unshift(`${y}-${String(m).padStart(2, "0")}`); if (--m === 0) { m = 12; y--; } }
  } else {
    const paso = grupo === "semana" ? 7 : 1;
    const fin = grupo === "semana" ? claveSemana(hoy) : hoy;
    for (let i = n - 1; i >= 0; i--) claves.push(sumarDias(fin, -i * paso));
  }
  return claves;
}

function etiqueta(grupo, clave) {
  if (grupo === "mes") { const [y, m] = clave.split("-"); return `${MESES[Number(m) - 1]} ${y.slice(2)}`; }
  const dt = aUTC(clave);
  const dm = `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  return grupo === "semana" ? `Sem ${dm}` : `${DIAS[dt.getUTCDay()]} ${dm}`;
}

// Inicio (con margen de un día y medio) de un período, para acotar consultas
const desdeFecha = (clave) => new Date(aUTC(clave).getTime() - 36 * 3600e3);

// Instante en que empieza el día de negocio `clave` (HORA_CORTE en la zona local)
function desdeInicioDia(clave) {
  const t0 = aUTC(clave).getTime() + HORA_CORTE * 3600e3;
  const local = new Date(new Date(t0).toLocaleString("en-US", { timeZone: ZONA })).getTime();
  return new Date(t0 - (local - t0));
}

module.exports = { desdeInicioDia, ZONA, claveDia, claveSegun, claveSemana, claveMes, sumarDias, ultimosPeriodos, etiqueta, desdeFecha };
