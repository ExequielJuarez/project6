// Menú del cliente: elegir mesa, armar el pedido y enviarlo.
(() => {
  const datos = JSON.parse(document.getElementById("datos").textContent);
  const $ = (id) => document.getElementById(id);
  const pesos = (n) => "$" + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const VIGENCIA_MESA = 3 * 3600e3; // la mesa elegida se "olvida" a las 3 horas

  // ---- Estado guardado en el celular ----
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let mesa = null;
  let carrito = leer("sb_carrito", {}); // { idProducto: { cant, nota } }
  Object.keys(carrito).forEach((id) => { if (!datos.productos[id]) delete carrito[id]; });

  const m = leer("sb_mesa", null);
  if (datos.mesaUrl && datos.mesaUrl >= 1 && datos.mesaUrl <= datos.mesas) {
    setMesa(datos.mesaUrl); // vino por el QR de la mesa
    history.replaceState(null, "", location.pathname);
  } else if (m && Date.now() - m.ts < VIGENCIA_MESA && m.n <= datos.mesas) {
    mesa = m.n;
  }
  function setMesa(n) { mesa = n; guardar("sb_mesa", { n, ts: Date.now() }); pintarMesa(); }
  function pintarMesa() {
    $("mesaTxt").textContent = mesa ? `Mesa ${mesa}` : "Elegí tu mesa";
    $("btnMesa").classList.toggle("sin", !mesa);
  }

  function toast(txt) {
    const t = $("toast"); t.textContent = txt; t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), 2200);
  }
  async function api(url, opciones) {
    let r;
    try { r = await fetch(url, opciones); } catch { throw new Error("Sin conexión. Revisá tu internet y probá de nuevo."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.mensaje || "Algo salió mal");
    return j;
  }
  const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // ---- Carrito ----
  const cantidadTotal = () => Object.values(carrito).reduce((s, l) => s + l.cant, 0);
  const totalCarrito = () => Object.entries(carrito).reduce((s, [id, l]) => s + datos.productos[id].precio * l.cant, 0);

  function cambiar(id, delta) {
    const l = carrito[id] || { cant: 0, nota: "" };
    l.cant = Math.max(0, Math.min(20, l.cant + delta));
    if (l.cant === 0) delete carrito[id]; else carrito[id] = l;
    guardar("sb_carrito", carrito);
    pintarControl(id); pintarBarra();
    if ($("dlgCarrito").open) pintarCarrito();
  }
  function pintarControl(id) {
    const c = document.querySelector(`[data-control="${id}"]`); if (!c) return;
    const cant = carrito[id]?.cant || 0;
    c.innerHTML = cant
      ? `<div class="stepper"><button data-menos="${id}" aria-label="Quitar uno">−</button><span>${cant}</span><button data-mas="${id}" aria-label="Agregar uno">+</button></div>`
      : `<button class="btn-mas" data-mas="${id}" ${datos.recibir ? "" : "disabled"}>Agregar</button>`;
  }
  function pintarBarra() {
    const n = cantidadTotal();
    $("barraCarrito").hidden = n === 0;
    $("bcCant").textContent = n; $("bcTotal").textContent = pesos(totalCarrito());
  }
  function pintarCarrito() {
    $("carritoMesa").textContent = mesa ? `mesa ${mesa}` : "mesa (sin elegir)";
    const ids = Object.keys(carrito);
    $("carritoLista").innerHTML = ids.length ? ids.map((id) => {
      const p = datos.productos[id], l = carrito[id];
      return `<div class="fila"><div><div class="fila-nombre">${esc(p.nombre)}</div><small>${pesos(p.precio)} c/u</small></div>
        <div style="text-align:right"><div class="fila-precio">${pesos(p.precio * l.cant)}</div>
        <div class="stepper"><button data-menos="${id}" aria-label="Quitar uno">−</button><span>${l.cant}</span><button data-mas="${id}" aria-label="Agregar uno">+</button></div></div>
        <div class="fila-nota"><input data-nota="${id}" maxlength="200" placeholder="Aclaración (ej: sin cebolla)" value="${esc(l.nota)}"></div></div>`;
    }).join("") : '<p class="dlg-sub">Todavía no agregaste nada.</p>';
    $("carritoTotal").textContent = pesos(totalCarrito());
    $("btnEnviar").disabled = !ids.length;
    $("btnEnviar").textContent = mesa ? `Enviar pedido a Mesa ${mesa}` : "Elegir mesa y enviar";
  }

  document.addEventListener("click", (e) => {
    const mas = e.target.closest("[data-mas]"), menos = e.target.closest("[data-menos]");
    if (mas) return cambiar(mas.dataset.mas, 1);
    if (menos) return cambiar(menos.dataset.menos, -1);
    if (e.target.closest("[data-cerrar]")) e.target.closest("dialog").close();
    // tocar el fondo oscuro cierra el diálogo
    if (e.target.tagName === "DIALOG") e.target.close();
  });
  document.addEventListener("input", (e) => {
    const id = e.target.dataset?.nota;
    if (id && carrito[id]) { carrito[id].nota = e.target.value; guardar("sb_carrito", carrito); }
  });

  // ---- Mesa ----
  function abrirMesas(despues) {
    $("gridMesas").innerHTML = Array.from({ length: datos.mesas }, (_, i) => `<button class="mesa-btn${mesa === i + 1 ? " sel" : ""}" data-mesa="${i + 1}">${i + 1}</button>`).join("");
    abrirMesas.despues = despues; $("dlgMesa").showModal();
  }
  $("gridMesas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mesa]"); if (!b) return;
    setMesa(Number(b.dataset.mesa)); $("dlgMesa").close();
    const fn = abrirMesas.despues; abrirMesas.despues = null; if (fn) fn();
  });
  $("btnMesa").onclick = () => abrirMesas();
  $("cambiarMesa").onclick = () => abrirMesas(pintarCarrito);

  // ---- Enviar ----
  $("barraCarrito").onclick = () => { $("carritoError").hidden = true; pintarCarrito(); $("dlgCarrito").showModal(); };
  $("btnEnviar").onclick = async () => {
    if (!mesa) return abrirMesas(() => $("btnEnviar").click());
    const btn = $("btnEnviar"); $("carritoError").hidden = true; btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const items = Object.entries(carrito).map(([id, l]) => ({ productoId: Number(id), cantidad: l.cant, nota: l.nota }));
      const r = await post("/api/pedidos", { mesa, items });
      carrito = {}; guardar("sb_carrito", carrito);
      Object.keys(datos.productos).forEach(pintarControl); pintarBarra();
      $("dlgCarrito").close();
      $("listoTxt").textContent = `Mesa ${r.mesa}: ya lo recibimos y lo estamos preparando.`;
      $("dlgListo").showModal();
    } catch (err) {
      $("carritoError").textContent = err.message; $("carritoError").hidden = false;
    } finally { pintarCarrito(); }
  };

  // ---- Mi cuenta ----
  async function abrirCuenta() {
    if (!mesa) return abrirMesas(abrirCuenta);
    $("cuentaMesa").textContent = `Mesa ${mesa}`;
    $("cuentaLista").innerHTML = '<p class="dlg-sub">Cargando…</p>';
    $("cuentaMsg").hidden = true; $("cuentaBotones").hidden = true; $("cuentaTotalFila").hidden = true;
    if (!$("dlgCuenta").open) $("dlgCuenta").showModal();
    try {
      const { cuenta } = await api(`/api/mesas/${mesa}/cuenta`);
      if (!cuenta) { $("cuentaLista").innerHTML = '<p class="dlg-sub">Todavía no pediste nada en esta mesa.</p>'; return; }
      $("cuentaLista").innerHTML = cuenta.resumen.map((r) => `<div class="fila"><div><div class="fila-nombre">${r.cantidad} × ${esc(r.nombre)}</div>${r.nota ? `<small>${esc(r.nota)}</small>` : ""}</div><div class="fila-precio">${pesos(r.subtotal)}</div></div>`).join("");
      $("cuentaTotal").textContent = pesos(cuenta.total);
      $("cuentaTotalFila").hidden = false; $("cuentaBotones").hidden = false;
      if (cuenta.aviso) mostrarMsg(cuenta.aviso === "cuenta" ? "Ya avisamos que querés la cuenta. ¡Enseguida vamos!" : "Ya avisamos al mozo. ¡Enseguida vamos!");
    } catch (err) { $("cuentaLista").innerHTML = `<p class="error">${esc(err.message)}</p>`; }
  }
  function mostrarMsg(t, error) { const el = $("cuentaMsg"); el.textContent = t; el.hidden = false; el.style.color = error ? "" : "#3f6a3a"; }
  async function avisar(tipo) {
    try { await post(`/api/mesas/${mesa}/aviso`, { tipo }); mostrarMsg("¡Listo! Ya le avisamos al mozo, enseguida vamos."); }
    catch (err) { mostrarMsg(err.message, true); }
  }
  $("btnCuenta").onclick = abrirCuenta;
  $("listoCuenta").onclick = () => { $("dlgListo").close(); abrirCuenta(); };
  $("btnPedirCuenta").onclick = () => avisar("cuenta");
  $("btnMozo").onclick = () => avisar("mozo");

  // ---- Horarios ----
  $("btnHorarios").onclick = () => $("dlgHorarios").showModal();
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activa", x === t));
    $("imgHorario").src = t.dataset.tab === "noche" ? "/img/horarios-noche.webp" : "/img/horarios-cafeteria.webp";
  }));

  // ---- Categorías: la activa sigue al scroll, y al tocar una se baja a su sección ----
  // OJO: no usar scrollIntoView acá: mueve también la página y pelea contra el scroll del usuario.
  const barra = $("cats");
  const links = [...document.querySelectorAll(".cat")];
  let bloqueada = false; // tras tocar una categoría, se respeta hasta que el usuario vuelva a scrollear
  function marcar(id) {
    let activa = null;
    links.forEach((l) => { const si = l.dataset.cat === id; l.classList.toggle("activa", si); if (si) activa = l; });
    if (activa) { // solo se mueve la barra horizontal, nunca la página
      const destino = activa.offsetLeft - (barra.clientWidth - activa.offsetWidth) / 2;
      barra.scrollTo({ left: destino, behavior: "smooth" });
    }
  }
  const secciones = [...document.querySelectorAll(".categoria")];
  const topeFijo = () => document.querySelector(".top").offsetHeight + barra.offsetHeight;
  function actualizarActiva() {
    if (bloqueada || !secciones.length) return;
    const linea = topeFijo() + 40; // la sección "actual" es la última cuyo título ya pasó esta línea
    let actual = secciones[0];
    for (const s of secciones) if (s.getBoundingClientRect().top <= linea) actual = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) actual = secciones[secciones.length - 1];
    if (!actual.dataset.pintada || actual.dataset.cat !== document.querySelector(".cat.activa")?.dataset.cat) marcar(actual.dataset.cat);
    actual.dataset.pintada = "1";
  }
  let pendiente = false;
  addEventListener("scroll", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(() => { pendiente = false; actualizarActiva(); }); } }, { passive: true });
  ["wheel", "touchstart", "keydown"].forEach((ev) => addEventListener(ev, () => { bloqueada = false; }, { passive: true }));
  barra.addEventListener("click", (e) => {
    const l = e.target.closest(".cat"); if (!l) return;
    e.preventDefault();
    const seccion = document.getElementById(`cat-${l.dataset.cat}`);
    bloqueada = true; marcar(l.dataset.cat);
    window.scrollTo({ top: seccion.getBoundingClientRect().top + scrollY - topeFijo() - 8, behavior: "smooth" });
  });

  // ---- Inicio ----
  Object.keys(datos.productos).forEach(pintarControl);
  pintarBarra(); pintarMesa();
  if (!mesa) setTimeout(() => abrirMesas(), 400);
})();
