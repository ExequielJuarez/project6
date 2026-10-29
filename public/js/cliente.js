// Menú del cliente: la mesa se fija escaneando el QR de la mesa; armar el pedido y enviarlo.
(() => {
  const datos = JSON.parse(document.getElementById("datos").textContent);
  const $ = (id) => document.getElementById(id);
  const pesos = (n) => "$" + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const VIGENCIA_MESA = 3 * 3600e3; // la mesa del QR se "olvida" a las 3 horas

  // ---- Estado guardado en el celular ----
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let mesa = null, tokenMesa = ""; // mesa y código secreto que vienen en el QR
  let carrito = leer("sb_carrito", {}); // { idProducto: { cant, nota } }
  Object.keys(carrito).forEach((id) => { if (!datos.productos[id]) delete carrito[id]; });

  // Modo: en mesa o delivery (si el local no tiene delivery, siempre mesa)
  let modo = datos.delivery && leer("sb_modo", "mesa") === "delivery" ? "delivery" : "mesa";
  let pago = "efectivo";
  const cliente = leer("sb_cliente", {});

  // La mesa SOLO se fija escaneando el QR (?mesa=4&t=código). Sin QR no hay mesa.
  const m = leer("sb_mesa", null);
  let qrViejo = false;
  if (datos.mesaUrl >= 1 && datos.mesaUrl <= datos.mesas && datos.tokenUrl) {
    setMesa(datos.mesaUrl, datos.tokenUrl);
    history.replaceState(null, "", location.pathname); // saca el código de la barra de direcciones
  } else if (datos.mesaUrl) {
    qrViejo = true; // un QR impreso antes de que existieran los códigos
  } else if (m && m.t && Date.now() - m.ts < VIGENCIA_MESA && m.n >= 1 && m.n <= datos.mesas) {
    mesa = m.n; tokenMesa = m.t;
  }
  function setMesa(n, t) { mesa = n; tokenMesa = t; guardar("sb_mesa", { n, t, ts: Date.now() }); }
  function olvidarMesa() { mesa = null; tokenMesa = ""; guardar("sb_mesa", null); }
  const puedePedir = () => modo === "delivery" || (datos.recibir && Boolean(mesa));
  const motivoBloqueo = () => (!datos.recibir && modo === "mesa" ? "Por ahora no tomamos pedidos desde el celular. Pedile al mozo 🙂" : "Escaneá el QR de tu mesa para pedir (o elegí Delivery).");

  function pintarMesa() {
    const delivery = modo === "delivery";
    $("mesaTxt").textContent = delivery ? "Delivery a domicilio" : mesa ? `Mesa ${mesa}` : "Escaneá el QR de tu mesa";
    $("btnMesa").classList.toggle("sin", !delivery && !mesa);
    $("ubicDer").hidden = !(delivery && datos.tiempo);
    $("ubicDerTxt").textContent = datos.tiempo || "";
    const av = $("avisoQr");
    av.hidden = delivery || Boolean(mesa);
    av.textContent = qrViejo ? "Ese código QR ya no sirve. Pedile al mozo que te indique el QR actual de tu mesa 🙂" : "Para pedir en tu mesa, escaneá el código QR que está en ella. También podés pedir por Delivery.";
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
    if (delta > 0 && !puedePedir()) return toast(motivoBloqueo());
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
      : `<button class="btn-mas${puedePedir() ? "" : " bloq"}" data-mas="${id}" aria-label="Agregar al pedido">+</button>`;
  }
  function pintarBarra() {
    const n = cantidadTotal();
    $("barraCarrito").hidden = n === 0;
    $("bcCant").textContent = n; $("bcTotal").textContent = pesos(totalCarrito());
    $("insignia").hidden = n === 0; $("insignia").textContent = n;
  }
  const subtotalCarrito = () => totalCarrito();
  const envio = () => (modo === "delivery" ? Number(datos.envio) || 0 : 0);
  function pintarCarrito() {
    const delivery = modo === "delivery";
    $("paraMesa").hidden = delivery; $("datosDelivery").hidden = !delivery;
    $("carritoMesa").textContent = mesa ? `mesa ${mesa}` : "mesa (escaneá el QR)";
    $("notaCarrito").textContent = delivery ? "Te escribimos por WhatsApp para confirmar tu pedido. El pago se hace al recibirlo." : "Si después querés algo más, pedilo de nuevo o avisale al mozo. Pagás al final, en la mesa.";
    $("totalEtq").textContent = delivery ? "Total a pagar" : "Total de este pedido";
    $("carritoDesglose").hidden = !(delivery && envio() > 0);
    $("carritoDesglose").innerHTML = `<div><span>Productos</span><span>${pesos(subtotalCarrito())}</span></div><div><span>Envío</span><span>${pesos(envio())}</span></div>`;
    const ids = Object.keys(carrito);
    $("carritoLista").innerHTML = ids.length ? ids.map((id) => {
      const p = datos.productos[id], l = carrito[id];
      return `<div class="fila"><div><div class="fila-nombre">${esc(p.nombre)}</div><small>${pesos(p.precio)} c/u</small></div>
        <div style="text-align:right"><div class="fila-precio">${pesos(p.precio * l.cant)}</div>
        <div class="stepper"><button data-menos="${id}" aria-label="Quitar uno">−</button><span>${l.cant}</span><button data-mas="${id}" aria-label="Agregar uno">+</button></div></div>
        <div class="fila-nota"><input data-nota="${id}" maxlength="200" placeholder="Aclaración (ej: sin cebolla)" value="${esc(l.nota)}"></div></div>`;
    }).join("") : '<p class="dlg-sub">Todavía no agregaste nada.</p>';
    $("carritoTotal").textContent = pesos(totalCarrito() + envio());
    $("btnEnviar").disabled = !ids.length || (!delivery && !mesa);
    $("btnEnviar").textContent = delivery ? "Enviar pedido de delivery" : mesa ? `Enviar pedido a Mesa ${mesa}` : "Escaneá el QR de tu mesa para pedir";
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

  // ---- Enviar ----
  function abrirCarrito() { $("carritoError").hidden = true; pintarCarrito(); if (!$("dlgCarrito").open) $("dlgCarrito").showModal(); }
  $("barraCarrito").onclick = abrirCarrito;
  $("btnCarritoTop").onclick = abrirCarrito;
  $("btnEnviar").onclick = async () => {
    if (modo === "delivery") return enviarDelivery();
    if (!mesa) return toast(motivoBloqueo());
    const btn = $("btnEnviar"); $("carritoError").hidden = true; btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const items = Object.entries(carrito).map(([id, l]) => ({ productoId: Number(id), cantidad: l.cant, nota: l.nota }));
      const r = await post("/api/pedidos", { mesa, token: tokenMesa, items });
      carrito = {}; guardar("sb_carrito", carrito);
      Object.keys(datos.productos).forEach(pintarControl); pintarBarra();
      $("dlgCarrito").close();
      $("listoTxt").textContent = `Mesa ${r.mesa}: ya lo recibimos y lo estamos preparando.`;
      $("listoTransf").hidden = true; $("listoCuenta").hidden = false;
      $("dlgListo").showModal();
    } catch (err) {
      $("carritoError").textContent = err.message; $("carritoError").hidden = false;
      if (/QR/.test(err.message)) { olvidarMesa(); pintarMesa(); Object.keys(datos.productos).forEach(pintarControl); } // el código ya no vale
    } finally { pintarCarrito(); }
  };

  // ---- Delivery ----
  const campos = { nombre: "dNombre", telefono: "dTel", direccion: "dDir", referencia: "dRef" };
  Object.entries(campos).forEach(([k, id]) => {
    $(id).value = cliente[k] || "";
    $(id).addEventListener("input", () => { cliente[k] = $(id).value; guardar("sb_cliente", cliente); $(id).classList.remove("mal"); $("carritoError").hidden = true; });
  });
  function pintarPago() {
    document.querySelectorAll(".pago").forEach((b) => b.classList.toggle("activa", b.dataset.pago === pago));
    $("dPagoConBox").hidden = pago !== "efectivo";
    $("dTransf").hidden = pago !== "transferencia" || !datos.transferencia;
    $("dTransf").textContent = datos.transferencia ? `Datos para transferir:\n${datos.transferencia}` : "";
    $("dTransf").style.whiteSpace = "pre-line";
  }
  $("dPagos").addEventListener("click", (e) => { const b = e.target.closest(".pago"); if (b) { pago = b.dataset.pago; pintarPago(); } });

  async function enviarDelivery() {
    const err = $("carritoError"); err.hidden = true;
    const falta = [["nombre", "Escribí tu nombre", (v) => v.trim().length >= 2], ["telefono", "Escribí tu WhatsApp con código de área", (v) => v.replace(/\D/g, "").length >= 8], ["direccion", "Escribí tu dirección de entrega", (v) => v.trim().length >= 5]]
      .find(([k, , ok]) => !ok(cliente[k] || ""));
    document.querySelectorAll(".datos input").forEach((i) => i.classList.remove("mal"));
    if (falta) { $(campos[falta[0]]).classList.add("mal"); $(campos[falta[0]]).focus(); err.textContent = falta[1]; err.hidden = false; return; }
    const btn = $("btnEnviar"); btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const items = Object.entries(carrito).map(([id, l]) => ({ productoId: Number(id), cantidad: l.cant, nota: l.nota }));
      const r = await post("/api/delivery", { cliente: { ...cliente, pago, pagoCon: pago === "efectivo" ? $("dPagoCon").value : "" }, items });
      carrito = {}; guardar("sb_carrito", carrito);
      Object.keys(datos.productos).forEach(pintarControl); pintarBarra();
      $("dlgCarrito").close();
      $("listoTxt").innerHTML = `Pedido <b>#${r.numero}</b> recibido. Te escribimos por WhatsApp al <b>${esc(cliente.telefono)}</b> para confirmarlo.`;
      const t = $("listoTransf"); t.hidden = !r.transferencia; t.textContent = r.transferencia ? `Datos para transferir:\n${r.transferencia}` : "";
      $("listoCuenta").hidden = true;
      $("dlgListo").showModal();
    } catch (e) { err.textContent = e.message; err.hidden = false; }
    finally { pintarCarrito(); }
  }

  // ---- Mi cuenta ----
  async function abrirCuenta() {
    if (!mesa) return toast(motivoBloqueo());
    $("cuentaMesa").textContent = `Mesa ${mesa}`;
    $("cuentaLista").innerHTML = '<p class="dlg-sub">Cargando…</p>';
    $("cuentaMsg").hidden = true; $("cuentaBotones").hidden = true; $("cuentaTotalFila").hidden = true;
    if (!$("dlgCuenta").open) $("dlgCuenta").showModal();
    try {
      const { cuenta } = await api(`/api/mesas/${mesa}/cuenta?t=${encodeURIComponent(tokenMesa)}`);
      if (!cuenta) { $("cuentaLista").innerHTML = '<p class="dlg-sub">Todavía no pediste nada en esta mesa.</p>'; return; }
      $("cuentaLista").innerHTML = cuenta.resumen.map((r) => `<div class="fila"><div><div class="fila-nombre">${r.cantidad} × ${esc(r.nombre)}</div>${r.nota ? `<small>${esc(r.nota)}</small>` : ""}</div><div class="fila-precio">${pesos(r.subtotal)}</div></div>`).join("");
      $("cuentaTotal").textContent = pesos(cuenta.total);
      $("cuentaTotalFila").hidden = false; $("cuentaBotones").hidden = false;
      if (cuenta.aviso) mostrarMsg(cuenta.aviso === "cuenta" ? "Ya avisamos que querés la cuenta. ¡Enseguida vamos!" : "Ya avisamos al mozo. ¡Enseguida vamos!");
    } catch (err) { $("cuentaLista").innerHTML = `<p class="error">${esc(err.message)}</p>`; }
  }
  function mostrarMsg(t, error) { const el = $("cuentaMsg"); el.textContent = t; el.hidden = false; el.style.color = error ? "" : "#3f6a3a"; }
  async function avisar(tipo) {
    try { await post(`/api/mesas/${mesa}/aviso`, { tipo, token: tokenMesa }); mostrarMsg("¡Listo! Ya le avisamos al mozo, enseguida vamos."); }
    catch (err) { mostrarMsg(err.message, true); }
  }
  $("listoCuenta").onclick = () => { $("dlgListo").close(); abrirCuenta(); };
  $("btnPedirCuenta").onclick = () => avisar("cuenta");
  $("btnMozo").onclick = () => avisar("mozo");

  // ---- Categorías y búsqueda: filtran lo que se ve (sin mover la página a los tirones) ----
  const secciones = [...document.querySelectorAll(".categoria")];
  const cats = [...document.querySelectorAll(".cat")];
  let catSel = "todas", busqueda = "";
  function filtrar() {
    let visibles = 0;
    secciones.forEach((sec) => {
      const deCat = catSel === "todas" || sec.dataset.cat === catSel;
      let hay = 0;
      sec.querySelectorAll(".prod").forEach((pr) => {
        const ok = deCat && (!busqueda || pr.dataset.txt.includes(busqueda));
        pr.hidden = !ok; if (ok) hay++;
      });
      sec.hidden = hay === 0; visibles += hay;
      sec.querySelector(".ver-todas").hidden = catSel !== "todas" || !!busqueda; // "Ver todas →" solo en la vista general
    });
    $("sinResultados").hidden = visibles > 0 || !secciones.length;
  }
  function elegirCategoria(id, subir = true) {
    catSel = id;
    cats.forEach((c) => c.classList.toggle("activa", c.dataset.cat === id));
    const activa = cats.find((c) => c.dataset.cat === id);
    if (activa) $("cats").scrollTo({ left: activa.offsetLeft - ($("cats").clientWidth - activa.offsetWidth) / 2, behavior: "smooth" });
    filtrar();
    if (subir) irAlListado();
  }
  function irAlListado() {
    const y = $("cats").getBoundingClientRect().top + scrollY - document.querySelector(".cab").offsetHeight - ($("buscador").hidden ? 0 : $("buscador").offsetHeight) - 4;
    if (scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
  $("cats").addEventListener("click", (e) => { const c = e.target.closest(".cat"); if (c) elegirCategoria(c.dataset.cat); });
  document.querySelectorAll(".ver-todas").forEach((b) => (b.onclick = () => elegirCategoria(b.dataset.ver)));
  $("banner").onclick = (e) => { e.preventDefault(); $("cats").scrollIntoView({ behavior: "smooth", block: "start" }); };

  $("btnBuscar").onclick = () => {
    const abrir = $("buscador").hidden;
    $("buscador").hidden = !abrir;
    if (abrir) $("q").focus();
    else { $("q").value = ""; busqueda = ""; filtrar(); }
  };
  $("q").addEventListener("input", () => { busqueda = $("q").value.trim().toLowerCase(); filtrar(); });

  // ---- Modo: en mesa / delivery ----
  function aplicarModo() {
    guardar("sb_modo", modo);
    document.querySelectorAll(".modo").forEach((b) => b.classList.toggle("activa", b.dataset.modo === modo));
    $("opBorrar").hidden = modo !== "delivery";
    pintarMesa();
    Object.keys(datos.productos).forEach(pintarControl); // los "+" se habilitan o bloquean según el modo
    if ($("dlgCarrito").open) pintarCarrito();
  }
  document.querySelectorAll(".modo").forEach((b) => (b.onclick = () => {
    modo = b.dataset.modo; aplicarModo();
    if ($("dlgOpciones").open) $("dlgOpciones").close();
  }));

  // ---- Barra inferior: Inicio · Pedidos · Cuenta ----
  const tabs = { inicio: $("tabInicio"), pedidos: $("tabPedidos"), cuenta: $("tabCuenta") };
  function marcarTab(n) { Object.entries(tabs).forEach(([k, el]) => el.classList.toggle("activa", k === n)); }
  tabs.inicio.onclick = () => { if ($("q").value) { $("q").value = ""; busqueda = ""; } elegirCategoria("todas", false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  tabs.pedidos.onclick = () => { marcarTab("pedidos"); modo === "delivery" ? abrirCarrito() : abrirCuenta(); };
  tabs.cuenta.onclick = () => { marcarTab("cuenta"); $("dlgOpciones").showModal(); };
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => marcarTab("inicio")));
  $("opBorrar").onclick = () => {
    Object.keys(campos).forEach((k) => { delete cliente[k]; $(campos[k]).value = ""; });
    guardar("sb_cliente", cliente); $("dlgOpciones").close(); toast("Borramos tus datos guardados");
  };

  // ---- Inicio ----
  Object.keys(datos.productos).forEach(pintarControl);
  pintarBarra(); pintarPago(); aplicarModo(); filtrar();
})();
