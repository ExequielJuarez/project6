// Panel de administración: pedidos en vivo (mesas + delivery), ventas, menú, caja y ajustes.
(() => {
  const BASE = document.body.dataset.base; // dirección secreta del panel (la pone el servidor)
  const ES_ADMIN = document.body.dataset.rol === "admin"; // el empleado solo ve Pedidos (el servidor también lo exige)
  const $ = (id) => document.getElementById(id);
  const pesos = (n) => "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const METODOS = { efectivo: "Efectivo", transferencia: "Transferencia" };
  const ICONO_PAGO = { efectivo: "💵", transferencia: "🏦", tarjeta: "💳", mercadopago: "📱" };
  const nombrePago = (m) => ({ ...METODOS, tarjeta: "Tarjeta", mercadopago: "Mercado Pago" }[m] || "-"); // tarjeta/MP: solo ventas viejas
  const hora = (f) => new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fechaHora = (f) => new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const hace = (f) => { const m = Math.max(0, Math.round((Date.now() - new Date(f)) / 60000)); return m < 1 ? "recién" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`; };
  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const num = (v) => (v === "" || v == null ? NaN : Number(String(v).replace(",", ".")));
  // WhatsApp: si el número no trae código de país, se asume Argentina (54 9)
  const waNumero = (t) => { let d = String(t || "").replace(/\D/g, "").replace(/^0+/, ""); if (!d.startsWith("54")) d = "549" + d.replace(/^15/, ""); return d; };

  const estado = {
    ajustes: null, vista: "pedidos", pedidos: [], filtro: "todos", menu: [],
    editandoId: null, destinoAgregar: null, stage: {},
    sonido: leer("sb_sonido", true), autoImprimir: leer("sb_auto_imprimir", false),
    dia: null,
  };

  // ---------- Utilidades ----------
  function toast(txt, error) {
    const t = $("toast"); t.textContent = txt; t.className = "toast" + (error ? " err" : ""); t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), error ? 4500 : 2400);
  }
  async function api(metodo, url, body) {
    const opc = { method: metodo, headers: {} };
    if (body instanceof FormData) opc.body = body;
    else if (body !== undefined) { opc.headers["Content-Type"] = "application/json"; opc.body = JSON.stringify(body); }
    let r;
    try { r = await fetch(url, opc); } catch { throw new Error("Sin conexión con el servidor"); }
    if (r.status === 401) { location.reload(); throw new Error("Sesión vencida"); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.mensaje || "Algo salió mal");
    return j;
  }
  const seguro = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

  // ---------- Sonido ----------
  function contexto() { return beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)()); }
  function beep() {
    if (!estado.sonido) return;
    try {
      const ctx = contexto(); ctx.resume?.();
      [[880, 0], [1175, 0.2], [880, 0.4], [1175, 0.6]].forEach(([f, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = "sine"; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.28);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3);
      });
    } catch {}
  }
  // Los navegadores bloquean el audio hasta que la persona toca algo: se avisa y se desbloquea con el primer toque
  function revisarSonido() {
    let bloqueado = false;
    try { bloqueado = estado.sonido && contexto().state !== "running"; } catch {}
    $("avisoSonido").hidden = !bloqueado;
  }
  const desbloquear = () => { try { contexto().resume().then(revisarSonido); } catch {} };
  document.addEventListener("pointerdown", desbloquear);
  document.addEventListener("keydown", desbloquear);

  // ---------- Impresión ----------
  let colaImpresion = Promise.resolve();
  function imprimir(html) {
    colaImpresion = colaImpresion.then(() => new Promise((ok) => {
      $("zonaImpresion").innerHTML = html;
      setTimeout(() => { window.print(); ok(); }, 60);
    }));
    return colaImpresion;
  }
  const titulo = (p) => (p.tipo === "delivery" ? `DELIVERY #${p.id}` : `MESA ${p.mesa}`);
  function itemsHtml(items) {
    return items.map((i) => `<div class="it">${i.cantidad} x ${esc(i.nombre)}${i.nota ? `<small>» ${esc(i.nota)}</small>` : ""}</div>`).join("");
  }
  // Comanda: lo que hay que preparar (para la cocina). Si se pasan `items`, solo esos (ronda nueva)
  function comandaHtml(p, items = p.items, esNuevo = true) {
    const dl = p.tipo === "delivery";
    return `<div class="ticket comanda">
      <div class="c"><h3>${esNuevo ? "Nuevo pedido" : "Pedido"}</h3></div>
      <div class="gran">${titulo(p)}</div>
      <div class="c">${fechaHora(new Date())}</div><hr>
      ${itemsHtml(items)}<hr>
      ${dl ? `<div class="it">${esc(p.cliente_nombre)}</div><div>Tel: ${esc(p.cliente_telefono)}</div><div>${esc(p.direccion)}</div>${p.referencia ? `<div>(${esc(p.referencia)})</div>` : ""}<hr>
        <div class="f"><span>Pago</span><span>${nombrePago(p.pago_preferido)}</span></div>
        ${p.pago_preferido === "efectivo" && p.pago_con ? `<div class="f"><span>Abona con</span><span>${pesos(p.pago_con)}</span></div><div class="f"><span>Vuelto</span><span>${pesos(p.pago_con - p.total)}</span></div>` : ""}
        ${p.envio > 0 ? `<div class="f"><span>Envío</span><span>${pesos(p.envio)}</span></div>` : ""}
        <div class="f tot"><span>TOTAL</span><span>${pesos(p.total)}</span></div>` : ""}
    </div>`;
  }
  // Ticket de venta (al cobrar / reimprimir)
  function ticketHtml(p) {
    const nombre = estado.ajustes?.nombre_local || "Street Burger";
    const dl = p.tipo === "delivery";
    return `<div class="ticket">
      <div class="c"><h3>${esc(nombre)}</h3><div>Coffee &amp; Burgers</div></div><hr>
      <div class="f"><span>Ticket N° ${String(p.numero_ticket || 0).padStart(4, "0")}</span><span>${dl ? `Delivery #${p.id}` : `Mesa ${p.mesa}`}</span></div>
      <div>${fechaHora(p.cerrado_en || new Date())}</div>
      ${dl ? `<div>${esc(p.cliente_nombre)} · ${esc(p.direccion)}</div>` : ""}<hr>
      ${p.resumen.map((r) => `<div class="it"><div class="f"><span>${r.cantidad} x ${esc(r.nombre)}</span><span>${pesos(r.subtotal)}</span></div>${r.nota ? `<small>${esc(r.nota)}</small>` : ""}</div>`).join("")}<hr>
      ${p.descuento > 0 || p.envio > 0 ? `<div class="f"><span>Subtotal</span><span>${pesos(p.subtotal)}</span></div>` : ""}
      ${p.descuento > 0 ? `<div class="f"><span>Descuento</span><span>-${pesos(p.descuento)}</span></div>` : ""}
      ${p.envio > 0 ? `<div class="f"><span>Envío</span><span>${pesos(p.envio)}</span></div>` : ""}
      <div class="f tot"><span>TOTAL</span><span>${pesos(p.total)}</span></div>
      <div class="f"><span>Pago</span><span>${nombrePago(p.metodo_pago)}</span></div>
      ${p.recibido ? `<div class="f"><span>Recibido</span><span>${pesos(p.recibido)}</span></div><div class="f"><span>Vuelto</span><span>${pesos(p.recibido - p.total)}</span></div>` : ""}
      <hr><div class="c">¡Gracias por tu compra!<br>Buena comida, mejores momentos<br><small>Documento no válido como factura</small></div></div>`;
  }
  function mostrarTicket(p, cerrado) {
    estado.ticket = p;
    $("dlgTicket").innerHTML = `<div class="dlg-cab"><h2>${cerrado ? "✓ Pasó a Ventas" : "Ticket"}</h2><button class="cerrar" data-a="cerrar-ticket" aria-label="Cerrar">✕</button></div>
      ${ticketHtml(p)}<div class="acciones"><button class="btn btn-principal" data-a="imprimir-ticket" style="flex:1">🖨️ Imprimir ticket</button><button class="btn" data-a="cerrar-ticket">${cerrado ? "Listo" : "Cerrar"}</button></div>`;
    if (!$("dlgTicket").open) $("dlgTicket").showModal();
  }

  // ---------- Navegación ----------
  const vistas = { pedidos: vistaPedidos, ventas: vistaVentas, menu: vistaMenu, caja: vistaCaja, ajustes: vistaAjustes };
  function ir(v) {
    if (!ES_ADMIN && v !== "pedidos") v = "pedidos";
    estado.vista = v;
    document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("activa", b.dataset.vista === v));
    document.querySelectorAll(".vista").forEach((s) => (s.hidden = s.id !== `vista-${v}`));
    window.scrollTo(0, 0);
    seguro(vistas[v])();
  }

  // ---------- PEDIDOS EN PANTALLA ----------
  async function vistaPedidos() { await cargarActivos(); }

  async function cargarActivos() {
    const j = await api("GET", BASE + "/api/pedidos/activos");
    estado.pedidos = j.pedidos; estado.mesasTotal = j.mesas; estado.caja = j.caja;
    const nuevos = j.pedidos.filter((p) => p.sinVer || p.aviso).length;
    $("pastillaPedidos").hidden = !nuevos; $("pastillaPedidos").textContent = nuevos;
    document.title = (nuevos ? `(${nuevos}) ` : "") + "Panel · Street Burger";
    if (estado.vista === "pedidos") pintarPedidos();
    if (estado.editandoId && $("dlgPedido").open) await pintarEditor();
  }

  // ---------- Caja ----------
  // La caja NO bloquea la navegación: en Pedidos aparece un aviso con "Abrir caja", y si intentás cobrar sin caja se ofrece abrirla ahí mismo.
  // Se cierra solo con la X.
  function abrirDialogCaja(despues) {
    $("dlgCaja").innerHTML = `<form id="formCajaObl">
      <div class="dlg-cab"><h2>Abrir la caja</h2><button type="button" class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      <p class="suave" style="margin-bottom:14px;font-size:1rem">Para cobrar o despachar pedidos hay que tener la caja abierta. Poné con cuánto efectivo empezás (el cambio).</p>
      <label class="campo"><span>Efectivo inicial ($)</span><input id="cajaMonto" name="monto" type="number" inputmode="decimal" min="0" step="any" required value="0"></label>
      <p class="error" id="cajaError" hidden></p>
      <button class="btn btn-principal" style="width:100%;padding:14px;font-size:1rem">Abrir caja</button></form>`;
    $("dlgCaja").showModal();
    setTimeout(() => $("cajaMonto")?.select(), 50);
    $("formCajaObl").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("POST", BASE + "/api/caja/abrir", { monto: $("cajaMonto").value });
      } catch (err) {
        if (!/ya está abierta/i.test(err.message)) { $("cajaError").textContent = err.message; $("cajaError").hidden = false; return; }
      }
      estado.caja = true; $("dlgCaja").close(); toast("Caja abierta. ¡Buen turno!");
      await cargarActivos();
      if (despues) despues();
    };
  }
  // Renglones iguales (mismo producto y aclaración) se muestran juntos; "nuevo" si alguno todavía no se vio
  function listaItems(p) {
    const g = new Map();
    for (const i of p.items) {
      const k = `${i.nombre}|${i.nota}`;
      const x = g.get(k) || { nombre: i.nombre, nota: i.nota, cantidad: 0, nuevo: false };
      x.cantidad += i.cantidad; x.nuevo = x.nuevo || !i.visto; g.set(k, x);
    }
    return `<ul class="items">${[...g.values()].map((i) => `<li class="${i.nuevo ? "nuevo-it" : ""}"><b>${i.cantidad}×</b> ${esc(i.nombre)}${i.nota ? `<em>» ${esc(i.nota)}</em>` : ""}</li>`).join("")}</ul>`;
  }
  const avisoTag = (p) => (p.aviso === "cuenta" ? '<span class="tag aviso">🧾 Pide la cuenta</span>' : p.aviso === "mozo" ? '<span class="tag aviso">🙋 Llama al mozo</span>' : "");

  function tarjetaMesa(p) {
    return `<article class="ped ${p.sinVer || p.aviso ? "nuevo" : ""}">
      <div class="ped-num"><small>MESA</small><b>${p.mesa}</b></div>
      <div class="ped-cuerpo">
        <div class="ped-cab">${p.sinVer ? '<span class="tag alerta">Nuevo</span>' : ""}${avisoTag(p)}<span>${hace(p.creado_en)}</span></div>
        ${listaItems(p)}
        <div class="ped-pie"><div class="total">${pesos(p.total)}</div>
          <div class="acciones">${p.sinVer || p.aviso ? `<button class="btn btn-chico" data-a="visto" data-id="${p.id}">✓ Visto</button>` : ""}
            <button class="btn btn-chico" data-a="imprimir-pedido" data-id="${p.id}">🖨️ Imprimir</button>
            <button class="btn btn-chico" data-a="editar" data-id="${p.id}">Editar</button>
            <button class="btn btn-principal btn-chico" data-a="cobrar" data-id="${p.id}">Cobrar y cerrar</button>
            <button class="btn btn-peligro btn-chico" data-a="cancelar" data-id="${p.id}">Cancelar pedido</button></div></div>
      </div></article>`;
  }
  function tarjetaDelivery(p) {
    const vuelto = p.pago_preferido === "efectivo" && p.pago_con ? p.pago_con - p.total : null;
    return `<article class="ped delivery ${p.sinVer ? "nuevo" : ""}">
      <div class="ped-num"><small>DELIVERY</small><b class="chico">#${p.id}</b></div>
      <div class="ped-cuerpo">
        <div class="ped-cab">${p.sinVer ? '<span class="tag alerta">Nuevo</span>' : ""}<span class="tag pago">${ICONO_PAGO[p.pago_preferido] || ""} ${nombrePago(p.pago_preferido)}</span><span>${hace(p.creado_en)}</span></div>
        <div class="datos-cli"><strong>${esc(p.cliente_nombre)}</strong>
          <span>📱 <a href="https://wa.me/${waNumero(p.cliente_telefono)}" target="_blank" rel="noopener">${esc(p.cliente_telefono)}</a></span>
          <span>📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion)}" target="_blank" rel="noopener">${esc(p.direccion)}</a></span>
          ${p.referencia ? `<span>🏠 ${esc(p.referencia)}</span>` : ""}</div>
        ${listaItems(p)}
        ${vuelto !== null || p.envio > 0 ? `<div class="pago-info">${p.envio > 0 ? `<div>🛵 Incluye envío: <b>${pesos(p.envio)}</b></div>` : ""}${vuelto !== null ? `<div>💵 Abona con: <b>${pesos(p.pago_con)}</b></div><div class="vuelto-grande">Vuelto a llevar: <b>${pesos(vuelto)}</b></div>` : ""}</div>` : ""}
        <div class="ped-pie"><div class="total">${pesos(p.total)}</div>
          <div class="acciones">${p.sinVer ? `<button class="btn btn-chico" data-a="visto" data-id="${p.id}">✓ Visto</button>` : ""}
            <button class="btn btn-chico" data-a="imprimir-pedido" data-id="${p.id}">🖨️ Imprimir</button>
            <a class="btn btn-chico" href="https://wa.me/${waNumero(p.cliente_telefono)}" target="_blank" rel="noopener" style="text-decoration:none">💬 WhatsApp</a>
            <button class="btn btn-chico" data-a="editar" data-id="${p.id}">Editar</button>
            <button class="btn btn-principal btn-chico" data-a="cobrar" data-id="${p.id}">Despachar</button>
            <button class="btn btn-peligro btn-chico" data-a="cancelar" data-id="${p.id}">Cancelar pedido</button></div></div>
      </div></article>`;
  }

  function pintarPedidos() {
    const mesas = estado.pedidos.filter((p) => p.tipo === "mesa");
    const deliverys = estado.pedidos.filter((p) => p.tipo === "delivery");
    const f = estado.filtro;
    const colMesas = `<div><div class="col-tit">Mesas <span>${mesas.length}</span></div>${mesas.map(tarjetaMesa).join("") || '<div class="vacio">No hay mesas con pedidos.<br>Cuando un cliente pida, aparece acá.</div>'}</div>`;
    const colDel = `<div><div class="col-tit">Delivery <span>${deliverys.length}</span></div>${deliverys.map(tarjetaDelivery).join("") || '<div class="vacio">No hay deliveries pendientes.</div>'}</div>`;
    $("vista-pedidos").innerHTML = `
      <div class="titulo-vista"><div><p class="eyebrow">Panel de administración</p><h2>Pedidos en curso</h2>
        <p>Se limpian solos: al cerrar la mesa o despachar el delivery pasan a <b>Ventas</b>.</p></div>
        <div class="herramientas">
          <button class="interruptor ${estado.sonido ? "on" : ""}" data-a="sonido"><i></i>Sonido</button>
          <button class="interruptor ${estado.autoImprimir ? "on" : ""}" data-a="auto-imprimir" title="Imprime la comanda sola cuando llega un pedido"><i></i>Imprimir automático</button>
          <button class="btn btn-principal" data-a="nueva-mesa">＋ Nueva mesa</button></div></div>
      ${estado.caja === false ? `<div class="banner-caja"><div><b>💵 La caja está cerrada.</b> Podés recibir pedidos, pero para cobrar o despachar ${ES_ADMIN ? "hay que abrirla." : "el administrador tiene que abrirla."}</div>${ES_ADMIN ? '<button class="btn btn-principal" data-a="abrir-caja">Abrir caja</button>' : ""}</div>` : ""}
      <div class="titulo-vista" style="margin-bottom:16px"><div class="seg">${[["todos", "Todos"], ["mesa", `Mesas (${mesas.length})`], ["delivery", `Delivery (${deliverys.length})`]].map(([k, t]) => `<button data-a="filtro" data-f="${k}" class="${f === k ? "sel" : ""}">${t}</button>`).join("")}</div></div>
      <div class="cols ${f === "todos" ? "" : "una"}">${f !== "delivery" ? colMesas : ""}${f !== "mesa" ? colDel : ""}</div>`;
  }

  // ----- Cancelar un pedido (siempre pide confirmación) -----
  function pedirCancelar(p) {
    const quien = p.tipo === "delivery" ? `el delivery #${p.id} de ${esc(p.cliente_nombre)}` : `el pedido de la Mesa ${p.mesa}`;
    const productos = (p.items || []).reduce((n, i) => n + i.cantidad, 0);
    $("dlgConfirmar").innerHTML = `
      <div class="dlg-cab"><h2>¿Cancelar el pedido?</h2><button class="cerrar" data-a="no-cancelar" aria-label="Cerrar">✕</button></div>
      <p class="confirmar-txt">Vas a cancelar <b>${quien}</b> (${productos} producto${productos === 1 ? "" : "s"} · <b>${pesos(p.total)}</b>).</p>
      <p class="suave" style="margin:8px 0 18px">No se cobra y <b>no queda registrado como venta</b>. Esto no se puede deshacer.</p>
      <div class="acciones" style="justify-content:flex-end">
        <button class="btn" data-a="no-cancelar">No, volver</button>
        <button class="btn btn-peligro lleno" data-a="si-cancelar" data-id="${p.id}">Sí, cancelar pedido</button></div>`;
    $("dlgConfirmar").showModal();
  }

  // ----- Editor de un pedido (cambiar cantidades, agregar, cancelar) -----
  async function abrirEditor(id) {
    estado.editandoId = Number(id);
    await pintarEditor();
    if (!$("dlgPedido").open) $("dlgPedido").showModal();
    await api("POST", `${BASE}/api/pedidos/${id}/visto`).catch(() => {});
  }
  async function pintarEditor() {
    const { pedido: p } = await api("GET", `${BASE}/api/pedidos/${estado.editandoId}`);
    if (p.estado !== "abierto") { $("dlgPedido").close(); estado.editandoId = null; return; }
    estado.pedido = p;
    $("dlgPedido").innerHTML = `
      <div class="dlg-cab"><h2>${p.tipo === "delivery" ? `Delivery #${p.id}` : `Mesa ${p.mesa}`}</h2><button class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      ${p.tipo === "delivery" ? `<p class="suave" style="margin-bottom:10px">${esc(p.cliente_nombre)} · ${esc(p.cliente_telefono)} · ${esc(p.direccion)}</p>` : ""}
      <div class="lineas">${p.items.map((i) => `
        <div class="linea">
          <div class="nombre">${esc(i.nombre)}${i.origen === "admin" ? '<span class="etq">AGREGADO</span>' : ""}</div>
          <div class="paso"><button data-a="cant" data-id="${i.id}" data-c="${i.cantidad - 1}" aria-label="Quitar uno">−</button><span>${i.cantidad}</span><button data-a="cant" data-id="${i.id}" data-c="${i.cantidad + 1}" aria-label="Agregar uno">+</button></div>
          <div class="importe">${pesos(i.precio * i.cantidad)}</div>
          ${i.nota ? `<div class="nota">» ${esc(i.nota)}</div>` : ""}
        </div>`).join("")}</div>
      <div class="totales">
        ${p.envio > 0 ? `<div class="t"><span>Envío</span><span>${pesos(p.envio)}</span></div>` : ""}
        <div class="t grande"><span>Total</span><span>${pesos(p.total)}</span></div></div>
      <div class="acciones">
        <button class="btn" data-a="agregar">＋ Agregar producto</button>
        <button class="btn btn-principal" data-a="cobrar" data-id="${p.id}">${p.tipo === "delivery" ? "Despachar" : "Cobrar y cerrar"}</button>
        <button class="btn btn-peligro btn-chico" data-a="cancelar-pedido">Cancelar pedido</button></div>`;
  }

  // ----- Agregar productos (a un pedido existente o a una mesa nueva) -----
  async function abrirAgregar(destino) {
    if (!estado.menu.length) estado.menu = (await api("GET", BASE + "/api/menu")).categorias;
    estado.destinoAgregar = destino; estado.stage = {}; estado.filtroCat = null; estado.busqueda = "";
    pintarAgregar(); $("dlgAgregar").showModal();
  }
  function pintarAgregar() {
    const cats = estado.menu.filter((c) => c.activo && c.productos.some((p) => p.activo));
    const q = (estado.busqueda || "").toLowerCase();
    const prods = cats.filter((c) => !estado.filtroCat || c.id === estado.filtroCat).flatMap((c) => c.productos.filter((p) => p.activo && (!q || p.nombre.toLowerCase().includes(q))));
    const stage = Object.entries(estado.stage);
    const todos = estado.menu.flatMap((c) => c.productos);
    const total = stage.reduce((s, [id, c]) => s + todos.find((p) => p.id == id).precio * c, 0);
    const buscando = document.activeElement?.id === "bProd";
    const d = estado.destinoAgregar;
    $("dlgAgregar").innerHTML = `
      <div class="dlg-cab"><h2>Agregar a ${d.mesa ? `Mesa ${d.mesa}` : "la cuenta"}</h2><button class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      <div class="buscar"><input id="bProd" type="search" placeholder="Buscar producto…" value="${esc(estado.busqueda || "")}">
        <div class="chips"><button class="chip ${!estado.filtroCat ? "sel" : ""}" data-a="filtro-cat" data-id="">Todos</button>${cats.map((c) => `<button class="chip ${estado.filtroCat === c.id ? "sel" : ""}" data-a="filtro-cat" data-id="${c.id}">${c.icono} ${esc(c.nombre)}</button>`).join("")}</div></div>
      <div class="opciones">${prods.map((p) => `<button class="opcion" data-a="stage" data-id="${p.id}"><b>${esc(p.nombre)}</b><span>${pesos(p.precio)}</span>${estado.stage[p.id] ? `<i class="cuenta">${estado.stage[p.id]}</i>` : ""}</button>`).join("") || '<p class="vacio">Sin resultados</p>'}</div>
      ${stage.length ? `<div style="margin-top:14px;border-top:2px solid var(--tinta);padding-top:10px">
        ${stage.map(([id, c]) => `<div class="linea" style="grid-template-columns:1fr auto"><div class="nombre">${esc(todos.find((p) => p.id == id).nombre)}</div><div class="paso"><button data-a="stage-menos" data-id="${id}">−</button><span>${c}</span><button data-a="stage" data-id="${id}">+</button></div></div>`).join("")}
        <button class="btn btn-principal" style="width:100%;margin-top:10px;padding:13px" data-a="confirmar-agregar">Agregar · ${pesos(total)}</button></div>` : ""}`;
    if (buscando) { const i = $("bProd"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  // ----- Cobrar mesa / despachar delivery -----
  function abrirCobro(id) {
    const p = estado.pedidos.find((x) => x.id === Number(id)) || estado.pedido;
    const dl = p.tipo === "delivery";
    estado.cobro = { id: p.id, p, metodo: p.pago_preferido && METODOS[p.pago_preferido] ? p.pago_preferido : "efectivo", descuento: 0, recibido: "" };
    $("dlgCobro").innerHTML = `
      <div class="dlg-cab"><h2>${dl ? `Despachar #${p.id}` : `Cobrar · Mesa ${p.mesa}`}</h2><button class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      ${dl ? `<p class="suave" style="margin-bottom:10px">${esc(p.cliente_nombre)} · ${esc(p.direccion)}</p>` : ""}
      ${!dl ? `<div class="totales"><div class="t"><span>Subtotal</span><b>${pesos(p.subtotal)}</b></div></div>
      <label class="campo"><span>Descuento ($)</span><input id="cDesc" type="number" inputmode="decimal" min="0" step="any" placeholder="0">
        <div class="rapidos">${[5, 10, 15, 20].map((x) => `<button type="button" class="chip" data-a="pct" data-p="${x}">${x}%</button>`).join("")}<button type="button" class="chip" data-a="pct" data-p="0">Sin descuento</button></div></label>` : ""}
      <div class="totales"><div class="t grande"><span>Total</span><span id="cTotal"></span></div></div>
      <div class="metodos">${Object.entries(METODOS).map(([k, v]) => `<button type="button" class="metodo" data-a="metodo" data-m="${k}">${ICONO_PAGO[k]} ${v}</button>`).join("")}</div>
      <div id="cEfectivo"><label class="campo"><span>Efectivo recibido <small>(opcional, para calcular el vuelto)</small></span><input id="cRec" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${dl && p.pago_con ? p.pago_con : ""}">
        <div class="rapidos" id="cRapidos"></div></label><div id="cVuelto"></div></div>
      <div class="acciones"><button class="btn btn-principal" data-a="confirmar-cobro" id="btnCobrar" style="flex:1;padding:13px">${dl ? "Despachar y pasar a Ventas" : "Cobrar, cerrar mesa y pasar a Ventas"}</button></div>`;
    actualizarCobro(); $("dlgCobro").showModal();
  }
  function actualizarCobro() {
    const c = estado.cobro, p = c.p;
    c.descuento = p.tipo === "mesa" ? Math.min(Math.max(num($("cDesc")?.value) || 0, 0), p.subtotal) : 0;
    c.recibido = $("cRec") ? $("cRec").value : "";
    const total = Math.round((p.subtotal - c.descuento + (p.envio || 0)) * 100) / 100;
    c.total = total;
    $("cTotal").textContent = pesos(total);
    $("cEfectivo").hidden = c.metodo !== "efectivo";
    document.querySelectorAll(".metodo").forEach((b) => b.classList.toggle("sel", b.dataset.m === c.metodo));
    const redondeos = [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000])].filter((x) => x >= total).slice(0, 4);
    $("cRapidos").innerHTML = redondeos.map((x) => `<button type="button" class="chip" data-a="recibido" data-v="${x}">${x === total ? "Justo" : pesos(x)}</button>`).join("");
    const rec = num(c.recibido);
    $("cVuelto").innerHTML = Number.isFinite(rec) ? (rec >= total ? `<div class="vuelto"><span>Vuelto</span><span>${pesos(rec - total)}</span></div>` : `<div class="vuelto mal"><span>Falta</span><span>${pesos(total - rec)}</span></div>`) : "";
  }

  // ---------- VENTAS ----------
  async function vistaVentas(dia) {
    const j = await api("GET", `${BASE}/api/ventas${dia || estado.dia ? `?dia=${dia || estado.dia}` : ""}`);
    estado.dia = j.dia;
    const r = j.resumen;
    $("vista-ventas").innerHTML = `<div class="titulo-vista"><div><p class="eyebrow">Panel de administración</p><h2>Ventas</h2><p>Todo lo que ya se cobró o despachó. Elegí un día para consultarlo.</p></div></div>
      <div class="kpis">
        <div class="kpi oscuro"><small>Hoy</small><strong>${pesos(r.hoy.ventas)}</strong><em>${r.hoy.pedidos} venta(s)</em></div>
        <div class="kpi"><small>Esta semana</small><strong>${pesos(r.semana.ventas)}</strong><em>${r.semana.pedidos} venta(s)</em></div>
        <div class="kpi"><small>Este mes</small><strong>${pesos(r.mes.ventas)}</strong><em>${r.mes.pedidos} venta(s)</em></div></div>
      <div class="tarjeta"><div class="titulo-vista" style="margin-bottom:12px"><h3 style="margin:0">Detalle del día</h3><input id="diaV" type="date" value="${j.dia}" style="width:auto"></div>
        <div class="acciones" style="margin-bottom:12px"><span class="tag pago">Total ${pesos(j.total)}</span>${Object.entries(j.porMetodo).map(([m, v]) => `<span class="tag">${ICONO_PAGO[m] || ""} ${nombrePago(m)} ${pesos(v)}</span>`).join("")}</div>
        ${j.pedidos.length ? `<table class="tabla"><thead><tr><th>Hora</th><th>Pedido</th><th>Pago</th><th class="der">Total</th></tr></thead><tbody>${j.pedidos.map((p) => `<tr class="click" data-a="ver-ticket" data-id="${p.id}"><td>${hora(p.cerrado_en)}</td><td>${p.tipo === "delivery" ? `🛵 #${p.id} · ${esc(p.cliente_nombre)}` : `🍽️ Mesa ${p.mesa}`}</td><td>${nombrePago(p.metodo_pago)}</td><td class="der"><b>${pesos(p.total)}</b></td></tr>`).join("")}</tbody></table><p class="suave" style="margin-top:10px">Tocá una venta para ver o reimprimir el ticket. (El día de negocio va de 5:00 a 5:00.)</p>` : '<p class="vacio">No hay ventas en este día.</p>'}</div>`;
    $("diaV").onchange = (e) => e.target.value && seguro(vistaVentas)(e.target.value);
  }

  // ---------- MENÚ ----------
  const plano = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  async function vistaMenu() {
    estado.menu = (await api("GET", BASE + "/api/menu")).categorias;
    estado.bMenu = ""; estado.catMenu = null;
    $("vista-menu").innerHTML = `<div class="titulo-vista"><div><p class="eyebrow">Panel de administración</p><h2>Menú</h2><p>Lo que ven tus clientes. Pausá un producto si se acabó.</p></div><button class="btn btn-principal" data-a="nueva-cat">＋ Categoría</button></div>
      <div class="buscador-menu"><input id="bMenu" type="search" placeholder="🔍 Buscar categoría o producto…" autocomplete="off" aria-label="Buscar en el menú">
        <div class="chips-menu" id="chipsMenu"></div></div>
      <div id="listaMenu"></div>`;
    pintarListaMenu();
  }
  // Filtra por texto (categoría o producto, sin importar tildes/mayúsculas) y por la categoría elegida arriba
  function pintarListaMenu() {
    const q = plano(estado.bMenu).trim();
    $("chipsMenu").innerHTML = [`<button class="chip ${estado.catMenu == null ? "sel" : ""}" data-a="cat-menu" data-id="">Todas</button>`,
      ...estado.menu.map((c) => `<button class="chip ${estado.catMenu === c.id ? "sel" : ""}" data-a="cat-menu" data-id="${c.id}">${esc(c.nombre)}</button>`)].join("");
    const visibles = estado.menu.map((c) => {
      if (estado.catMenu != null && c.id !== estado.catMenu) return null;
      if (!q || plano(c.nombre).includes(q)) return c; // coincide la categoría: se ve entera
      const prods = c.productos.filter((p) => plano(p.nombre).includes(q) || plano(p.descripcion).includes(q));
      return prods.length ? { ...c, productos: prods } : null;
    }).filter(Boolean);
    $("listaMenu").innerHTML = visibles.map((c) => `<div class="tarjeta cat-admin">
        <div class="cat-cab"><h3>${c.imagen ? `<img src="${esc(c.imagen)}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px">` : c.icono + " "}${esc(c.nombre)} ${c.activo ? "" : '<span class="etq">OCULTA</span>'}</h3>
          <button class="btn btn-chico" data-a="nuevo-prod" data-id="${c.id}">＋ Producto</button><button class="btn btn-chico" data-a="editar-cat" data-id="${c.id}">Editar</button></div>
        ${c.productos.map((p) => `<div class="prod-fila ${p.activo ? "" : "inactivo"}">
          <div class="mini">${p.imagen || c.imagen ? `<img src="${esc(p.imagen || c.imagen)}" alt="">` : c.icono}</div>
          <div><b>${esc(p.nombre)} ${p.activo ? "" : '<span class="etq">PAUSADO</span>'}</b><p class="suave">${esc(p.descripcion)}</p></div>
          <div class="importe">${pesos(p.precio)}</div>
          <div class="acciones"><button class="btn btn-chico" data-a="editar-prod" data-id="${p.id}">Editar</button></div></div>`).join("") || '<p class="suave">Sin productos todavía.</p>'}
      </div>`).join("") || (estado.menu.length ? '<p class="vacio">No encontré nada con esa búsqueda.</p>' : '<p class="vacio">Todavía no cargaste categorías. Empezá creando una (ej: Hamburguesas).</p>');
  }
  function abrirForm(tit, cuerpo, alEnviar) {
    $("dlgForm").innerHTML = `<form id="formDlg"><div class="dlg-cab"><h2>${tit}</h2><button type="button" class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>${cuerpo}</form>`;
    $("formDlg").onsubmit = seguro(async (e) => { e.preventDefault(); await alEnviar(new FormData(e.target)); });
    if (!$("dlgForm").open) $("dlgForm").showModal();
  }
  // Bloque de foto (producto o categoría): sube la imagen achicada y guarda su URL en #imgUrl
  const htmlFoto = (url, ayuda) => `<div class="campo"><span>Foto <small>${ayuda}</small></span>
        <img id="prev" class="vista-previa" alt="" ${url ? `src="${esc(url)}"` : "hidden"}>
        <input type="hidden" name="imagen" id="imgUrl" value="${esc(url)}"><input type="file" id="imgArchivo" accept="image/jpeg,image/png,image/webp">
        <button type="button" class="btn btn-chico" data-a="quitar-foto" style="margin-top:6px">Quitar foto</button></div>`;
  function enlazarFoto() {
    $("imgArchivo").onchange = seguro(async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const blob = await reducirImagen(f);
      const fd = new FormData(); fd.append("imagen", blob, "foto.jpg");
      const { url } = await api("POST", BASE + "/api/imagenes", fd);
      $("imgUrl").value = url; $("prev").src = url; $("prev").hidden = false;
    });
  }
  function formCategoria(c) {
    abrirForm(c ? "Editar categoría" : "Nueva categoría", `
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="80" value="${esc(c?.nombre)}"></label>
      <div class="fila-campos"><label class="campo"><span>Ícono (emoji)</span><input name="icono" maxlength="8" value="${esc(c?.icono || "🍽️")}"></label>
      <label class="campo"><span>Orden</span><input name="orden" type="number" value="${c?.orden ?? estado.menu.length}"></label></div>
      ${htmlFoto(c?.imagen, "(la usan los productos que no tienen foto propia)")}
      <label class="campo"><input type="checkbox" name="activo" ${c?.activo !== false ? "checked" : ""}> Visible en el menú</label>
      <div class="acciones"><button class="btn btn-principal" style="flex:1">Guardar</button>${c ? `<button type="button" class="btn btn-peligro" data-a="borrar-cat" data-id="${c.id}">Eliminar</button>` : ""}</div>`,
      async (fd) => {
        await api(c ? "PUT" : "POST", c ? `${BASE}/api/categorias/${c.id}` : BASE + "/api/categorias", { nombre: fd.get("nombre"), icono: fd.get("icono"), orden: fd.get("orden"), imagen: fd.get("imagen"), activo: fd.has("activo") });
        $("dlgForm").close(); toast("Categoría guardada"); vistaMenu();
      });
    enlazarFoto();
  }
  function formProducto(p, categoriaId) {
    abrirForm(p ? "Editar producto" : "Nuevo producto", `
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="120" value="${esc(p?.nombre)}"></label>
      <label class="campo"><span>Descripción <small>(opcional)</small></span><textarea name="descripcion" rows="2" maxlength="300">${esc(p?.descripcion)}</textarea></label>
      <div class="fila-campos"><label class="campo"><span>Precio ($)</span><input name="precio" type="number" inputmode="decimal" min="0" step="any" required value="${p?.precio ?? ""}"></label>
      <label class="campo"><span>Categoría</span><select name="categoria_id">${estado.menu.map((c) => `<option value="${c.id}" ${(p?.categoria_id ?? categoriaId) == c.id ? "selected" : ""}>${c.icono} ${esc(c.nombre)}</option>`).join("")}</select></label></div>
      ${htmlFoto(p?.imagen, "(si no subís una, usa la de la categoría)")}
      <label class="campo"><input type="checkbox" name="activo" ${p?.activo !== false ? "checked" : ""}> Disponible (destildalo si se acabó)</label>
      <div class="acciones"><button class="btn btn-principal" style="flex:1">Guardar</button>${p ? `<button type="button" class="btn btn-peligro" data-a="borrar-prod" data-id="${p.id}">Eliminar</button>` : ""}</div>`,
      async (fd) => {
        await api(p ? "PUT" : "POST", p ? `${BASE}/api/productos/${p.id}` : BASE + "/api/productos", { nombre: fd.get("nombre"), descripcion: fd.get("descripcion"), precio: fd.get("precio"), categoria_id: fd.get("categoria_id"), imagen: fd.get("imagen"), activo: fd.has("activo") });
        $("dlgForm").close(); toast("Producto guardado"); vistaMenu();
      });
    enlazarFoto();
  }
  function reducirImagen(archivo, max = 900) {
    return new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => mal(new Error("Esa imagen no se puede abrir"));
      img.src = URL.createObjectURL(archivo);
    });
  }

  // ---------- CAJA (opcional) ----------
  async function vistaCaja() {
    const { actual, historial } = await api("GET", BASE + "/api/caja");
    estado.caja = Boolean(actual); estado.historialCaja = historial;
    let html = `<div class="titulo-vista"><div><p class="eyebrow">Panel de administración</p><h2>Caja</h2><p>Opcional: sirve para controlar el efectivo del día. No hace falta para cobrar.</p></div></div>`;
    if (!actual) {
      html += `<div class="tarjeta"><h3>La caja está cerrada</h3><p class="suave" style="margin-bottom:12px">Abrila indicando con cuánto efectivo empezás (el cambio).</p>
        <form id="formAbrir"><label class="campo"><span>Efectivo inicial ($)</span><input name="monto" type="number" inputmode="decimal" min="0" step="any" required value="0"></label><button class="btn btn-principal">Abrir caja</button></form></div>`;
    } else {
      const t = actual.turno;
      html += `<p class="suave" style="margin-bottom:12px">Abierta desde ${fechaHora(t.creado_en)}</p>
        <div class="kpis">
          <div class="kpi oscuro"><small>Efectivo que debería haber</small><strong>${pesos(actual.esperado)}</strong><em>inicial + ventas en efectivo + ingresos − egresos</em></div>
          <div class="kpi"><small>Ventas del turno</small><strong>${pesos(actual.totalVentas)}</strong><em>${actual.pedidos} venta(s)</em></div>
          <div class="kpi"><small>Efectivo inicial</small><strong>${pesos(t.monto_inicial)}</strong></div>
          <div class="kpi"><small>Ingresos / Egresos</small><strong>${pesos(actual.ingresos)} / ${pesos(actual.egresos)}</strong></div></div>
        <div class="dos-col"><div class="tarjeta"><h3>Ventas por método</h3>${["efectivo", "transferencia", "tarjeta", "mercadopago"].filter((k) => ["efectivo", "transferencia"].includes(k) || actual.ventas[k]).map((k) => `<div class="metodo-fila"><span>${nombrePago(k)}</span><b>${pesos(actual.ventas[k])}</b></div>`).join("")}</div>
        <div class="tarjeta"><h3>Registrar movimiento</h3><form id="formMov">
          <div class="fila-campos"><label class="campo"><span>Tipo</span><select name="tipo"><option value="egreso">Egreso (sale plata)</option><option value="ingreso">Ingreso (entra plata)</option></select></label>
          <label class="campo"><span>Monto ($)</span><input name="monto" type="number" inputmode="decimal" min="0.01" step="any" required></label></div>
          <label class="campo"><span>Concepto</span><input name="concepto" required maxlength="150" placeholder="Ej: compra de pan, retiro, cambio…"></label>
          <button class="btn btn-principal">Registrar</button></form></div></div>
        <div class="tarjeta"><h3>Movimientos del turno</h3>${actual.movimientos.length ? `<table class="tabla"><tbody>${actual.movimientos.map((m) => `<tr><td>${hora(m.creado_en)}</td><td>${esc(m.concepto)}</td><td class="der ${m.tipo === "ingreso" ? "pos" : "neg"}">${m.tipo === "ingreso" ? "+" : "−"} ${pesos(m.monto)}</td></tr>`).join("")}</tbody></table>` : '<p class="suave">Sin movimientos.</p>'}</div>
        <div class="tarjeta"><h3>Cerrar caja</h3><p class="suave" style="margin-bottom:10px">Contá el efectivo del cajón. Se compara con lo que debería haber.</p>
          <form id="formCerrar"><div class="fila-campos"><label class="campo"><span>Efectivo contado ($)</span><input name="contado" type="number" inputmode="decimal" min="0" step="any" required></label>
          <label class="campo"><span>Nota <small>(opcional)</small></span><input name="nota" maxlength="250"></label></div><button class="btn btn-peligro">Cerrar caja del día</button></form></div>`;
    }
    html += `<div class="tarjeta"><h3>Cierres anteriores</h3>${historial.length ? `<table class="tabla"><thead><tr><th>Cierre</th><th class="der">Ventas</th><th class="der">Esperado</th><th class="der">Contado</th><th class="der">Diferencia</th><th></th></tr></thead><tbody>${historial.map((h) => `<tr><td>${fechaHora(h.cerrado_en)}</td><td class="der">${pesos(h.totalVentas)}</td><td class="der">${pesos(h.monto_esperado)}</td><td class="der">${pesos(h.monto_contado)}</td><td class="der ${h.diferencia === 0 ? "" : h.diferencia > 0 ? "pos" : "neg"}">${h.diferencia > 0 ? "+" : ""}${pesos(h.diferencia)}</td><td class="der"><button class="btn btn-chico btn-borrar" data-a="borrar-cierre" data-id="${h.id}" title="Borrar este cierre" aria-label="Borrar este cierre">🗑</button></td></tr>`).join("")}</tbody></table>` : '<p class="suave">Todavía no cerraste ninguna caja.</p>'}</div>`;
    $("vista-caja").innerHTML = html;
    const f = (id, fn) => $(id) && ($(id).onsubmit = seguro(async (e) => { e.preventDefault(); await fn(Object.fromEntries(new FormData(e.target))); }));
    f("formAbrir", async (b) => { await api("POST", BASE + "/api/caja/abrir", b); toast("Caja abierta"); vistaCaja(); });
    f("formMov", async (b) => { await api("POST", BASE + "/api/caja/movimientos", b); toast("Movimiento registrado"); vistaCaja(); });
    f("formCerrar", async (b) => {
      if (!confirm("¿Cerrar la caja?")) return;
      const { cierre } = await api("POST", BASE + "/api/caja/cerrar", b);
      alert(`Caja cerrada.\n\nEsperado: ${pesos(cierre.esperado)}\nContado: ${pesos(cierre.turno.monto_contado)}\nDiferencia: ${cierre.diferencia > 0 ? "+" : ""}${pesos(cierre.diferencia)}`);
      vistaCaja();
    });
  }

  // ---------- AJUSTES ----------
  async function vistaAjustes() {
    estado.ajustes = (await api("GET", BASE + "/api/ajustes")).ajustes;
    const a = estado.ajustes;
    $("nombreLocal").textContent = a.nombre_local;
    $("vista-ajustes").innerHTML = `<div class="titulo-vista"><div><p class="eyebrow">Panel de administración</p><h2>Ajustes</h2></div></div>
      <div class="tarjeta"><h3>El local</h3><form id="formAj">
        <div class="fila-campos"><label class="campo"><span>Nombre (sale en los tickets)</span><input name="nombre_local" required maxlength="60" value="${esc(a.nombre_local)}"></label>
        <label class="campo"><span>Cantidad de mesas</span><input name="cantidad_mesas" type="number" min="1" max="100" required value="${a.cantidad_mesas}"></label></div>
        <label class="campo"><input type="checkbox" name="recibir_pedidos" ${a.recibir_pedidos ? "checked" : ""}> Recibir pedidos de mesa desde el celular <small>(destildalo para pausarlos)</small></label>
        <label class="campo"><input type="checkbox" name="recibir_delivery" ${a.recibir_delivery ? "checked" : ""}> Recibir pedidos de delivery <small>(destildalo cuando no puedas enviar)</small></label>
        <div class="fila-campos"><label class="campo"><span>Costo de envío ($)</span><input name="costo_envio" type="number" inputmode="decimal" min="0" step="any" value="${a.costo_envio || 0}"></label>
        <label class="campo"><span>Tiempo estimado de entrega</span><input name="tiempo_estimado" maxlength="20" placeholder="30-45 min" value="${esc(a.tiempo_estimado)}"></label></div>
        <label class="campo"><span>Dirección del local <small>(se muestra en Horarios)</small></span><input name="direccion_local" maxlength="120" placeholder="Av. San Martín 123, La Banda" value="${esc(a.direccion_local)}"></label>
        <label class="campo"><span>Datos para transferencias <small>(se muestran al cliente que elige pagar por transferencia)</small></span><textarea name="transferencia_info" rows="3" maxlength="300" placeholder="Alias: street.burger&#10;CBU: 0000000000000000000000&#10;Titular: ...">${esc(a.transferencia_info)}</textarea></label>
        <button class="btn btn-principal">Guardar</button></form></div>
      <div class="tarjeta"><h3>Copia de seguridad</h3>
        <p class="suave" style="margin-bottom:12px">Descargá una copia de <b>todos tus datos</b> (productos, pedidos, ventas, cajas y ajustes). Guardala en tu computadora o en la nube. <b>Contiene datos de clientes</b>: no la compartas.</p>
        <div class="acciones"><a class="btn btn-principal" href="${BASE}/api/backup/base" download>⬇️ Descargar copia de la base de datos</a>
          <a class="btn" href="${BASE}/api/backup/fotos" download>🖼️ Descargar fotos subidas</a></div>
        <p class="suave" style="margin-top:12px;font-size:.9rem">Tip: descargala una vez por semana, o todos los días al cerrar la caja. Para restaurarla hace falta alguien que pueda usar la consola del servidor (la guía <code>DEPLOY.md</code> explica cómo).</p></div>
      <div class="tarjeta"><h3>QR de las mesas</h3>
        <p class="suave" style="margin-bottom:12px">Pegá el QR en cada mesa. <b>La mesa se fija solo escaneando su QR</b> (el cliente no puede elegirla a mano): cada código lleva una clave secreta, así nadie puede pedir en una mesa en la que no está.${/localhost|127\.0\.0\.1/.test(location.hostname) ? ' <b style="color:var(--alerta)">Ahora estás en localhost: cuando publiques el sitio, volvé a esta pantalla desde tu dirección real para generar los QR correctos.</b>' : ""}</p>
        <div class="acciones" style="margin-bottom:12px"><button class="btn" data-a="imprimir-qr">🖨️ Imprimir QR de todas las mesas</button></div>
        <div class="qr-grid" id="qrGrid"></div></div>`;
    $("formAj").onsubmit = seguro(async (e) => {
      e.preventDefault(); const fd = new FormData(e.target);
      estado.ajustes = (await api("PUT", BASE + "/api/ajustes", { nombre_local: fd.get("nombre_local"), cantidad_mesas: fd.get("cantidad_mesas"), recibir_pedidos: fd.has("recibir_pedidos"), recibir_delivery: fd.has("recibir_delivery"), costo_envio: fd.get("costo_envio") || 0, tiempo_estimado: fd.get("tiempo_estimado"), direccion_local: fd.get("direccion_local"), transferencia_info: fd.get("transferencia_info") })).ajustes;
      $("nombreLocal").textContent = estado.ajustes.nombre_local;
      toast("Ajustes guardados"); await pintarQR();
    });
    await pintarQR();
  }
  function qrSvg(url) {
    if (typeof qrcode === "undefined") return `<small>${esc(url)}</small>`;
    const q = qrcode(0, "M"); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  const qrHtml = () => (estado.qr || []).map(({ mesa, t }) => `<div class="qr-item"><b>Mesa ${mesa}</b>${qrSvg(`${location.origin}/?mesa=${mesa}&t=${t}`)}</div>`).join("");
  async function pintarQR() { estado.qr = (await api("GET", BASE + "/api/qr")).mesas; $("qrGrid").innerHTML = qrHtml(); }

  // ---------- Acciones (clicks) ----------
  const refrescar = async () => { await cargarActivos(); };
  const acciones = {
    "cerrar-dlg": (d, el) => el.closest("dialog").close(),
    filtro: (d) => { estado.filtro = d.f; pintarPedidos(); },
    sonido: () => { estado.sonido = !estado.sonido; guardar("sb_sonido", estado.sonido); if (estado.sonido) beep(); revisarSonido(); pintarPedidos(); },
    "auto-imprimir": () => { estado.autoImprimir = !estado.autoImprimir; guardar("sb_auto_imprimir", estado.autoImprimir); toast(estado.autoImprimir ? "Se imprime sola la comanda de cada pedido nuevo" : "Impresión automática desactivada"); pintarPedidos(); },
    visto: async (d) => { await api("POST", `${BASE}/api/pedidos/${d.id}/visto`); await refrescar(); },
    "imprimir-pedido": async (d) => {
      const { pedido } = await api("GET", `${BASE}/api/pedidos/${d.id}`);
      await api("POST", `${BASE}/api/pedidos/${d.id}/visto`); imprimir(comandaHtml(pedido, pedido.items, false)); refrescar();
    },
    editar: (d) => abrirEditor(d.id),
    cant: async (d) => { await api("PATCH", `${BASE}/api/items/${d.id}`, { cantidad: Number(d.c) }); await pintarEditor(); refrescar(); },
    agregar: () => abrirAgregar({ pedidoId: estado.pedido.id, mesa: estado.pedido.tipo === "mesa" ? estado.pedido.mesa : null }),
    "nueva-mesa": () => {
      const ocupadas = new Set(estado.pedidos.filter((p) => p.tipo === "mesa").map((p) => p.mesa));
      const libres = Array.from({ length: estado.mesasTotal }, (_, i) => i + 1).filter((n) => !ocupadas.has(n));
      abrirForm("¿Qué mesa?", libres.length ? `<p class="suave" style="margin-bottom:12px">Mesas libres:</p><div class="mesas-libres">${libres.map((n) => `<button type="button" class="mesa-libre" data-a="elegir-mesa" data-n="${n}">${n}</button>`).join("")}</div>` : '<p class="vacio">Todas las mesas están ocupadas.</p>', async () => {});
    },
    "elegir-mesa": (d) => { $("dlgForm").close(); abrirAgregar({ mesa: Number(d.n) }); },
    "filtro-cat": (d) => { estado.filtroCat = d.id ? Number(d.id) : null; pintarAgregar(); },
    stage: (d) => { estado.stage[d.id] = Math.min(20, (estado.stage[d.id] || 0) + 1); pintarAgregar(); },
    "stage-menos": (d) => { if (--estado.stage[d.id] <= 0) delete estado.stage[d.id]; pintarAgregar(); },
    "confirmar-agregar": async () => {
      const items = Object.entries(estado.stage).map(([productoId, cantidad]) => ({ productoId: Number(productoId), cantidad }));
      const dest = estado.destinoAgregar;
      let pedido;
      if (dest.pedidoId) pedido = (await api("POST", `${BASE}/api/pedidos/${dest.pedidoId}/items`, { items })).pedido;
      else pedido = (await api("POST", `${BASE}/api/mesas/${dest.mesa}/items`, { items })).pedido;
      $("dlgAgregar").close(); toast("Agregado al pedido");
      if (estado.autoImprimir) { // comanda solo con lo que se acaba de agregar
        const todos = estado.menu.flatMap((c) => c.productos);
        imprimir(comandaHtml(pedido, items.map((i) => ({ cantidad: i.cantidad, nombre: todos.find((p) => p.id === i.productoId)?.nombre || "", nota: "" })), true));
      }
      if ($("dlgPedido").open) await pintarEditor();
      refrescar();
    },
    "abrir-caja": () => abrirDialogCaja(),
    cobrar: (d) => {
      if (estado.caja !== false) return abrirCobro(d.id);
      if (!ES_ADMIN) return toast("La caja está cerrada. Pedile al administrador que la abra.", true);
      return abrirDialogCaja(() => abrirCobro(d.id)); // sin caja: la ofrece y sigue con el cobro
    },
    pct: (d) => { $("cDesc").value = Math.round(estado.cobro.p.subtotal * Number(d.p)) / 100 || ""; actualizarCobro(); },
    metodo: (d) => { estado.cobro.metodo = d.m; actualizarCobro(); },
    recibido: (d) => { $("cRec").value = d.v; actualizarCobro(); },
    "confirmar-cobro": async (d, el) => {
      const c = estado.cobro; el.disabled = true;
      try {
        const { pedido } = await api("POST", `${BASE}/api/pedidos/${c.id}/cerrar`, { metodo: c.metodo, descuento: c.descuento, recibido: c.metodo === "efectivo" && c.recibido !== "" ? c.recibido : undefined });
        $("dlgCobro").close(); if ($("dlgPedido").open) $("dlgPedido").close(); estado.editandoId = null;
        mostrarTicket(pedido, true); refrescar();
      } finally { el.disabled = false; }
    },
    "cancelar-pedido": () => pedirCancelar(estado.pedido), // desde el editor
    cancelar: (d) => pedirCancelar(estado.pedidos.find((p) => p.id === Number(d.id))), // desde la tarjeta
    "no-cancelar": () => $("dlgConfirmar").close(),
    "si-cancelar": async (d, el) => {
      el.disabled = true;
      try {
        await api("POST", `${BASE}/api/pedidos/${d.id}/cancelar`);
        $("dlgConfirmar").close(); if ($("dlgPedido").open) $("dlgPedido").close(); estado.editandoId = null;
        toast("Pedido cancelado"); refrescar();
      } catch (e) { el.disabled = false; throw e; }
    },
    "imprimir-ticket": () => imprimir(ticketHtml(estado.ticket)),
    "cerrar-ticket": () => $("dlgTicket").close(),
    "ver-ticket": async (d) => mostrarTicket((await api("GET", `${BASE}/api/pedidos/${d.id}`)).pedido, false),
    "cat-menu": (d) => { estado.catMenu = d.id ? Number(d.id) : null; pintarListaMenu(); },
    "borrar-cierre": (d) => {
      const h = estado.historialCaja.find((x) => x.id === Number(d.id)); if (!h) return;
      $("dlgConfirmar").innerHTML = `<div class="dlg-cab"><h2>¿Borrar este cierre?</h2><button class="cerrar" data-a="no-cancelar" aria-label="Cerrar">✕</button></div>
        <p class="confirmar-txt">Cierre del <b>${fechaHora(h.cerrado_en)}</b> · ventas <b>${pesos(h.totalVentas)}</b>.</p>
        <p class="suave" style="margin:8px 0 18px">Se borra de la lista y <b>no se puede deshacer</b>. Las ventas siguen apareciendo en Ventas.</p>
        <div class="acciones" style="justify-content:flex-end"><button class="btn" data-a="no-cancelar">No, volver</button><button class="btn btn-peligro lleno" data-a="si-borrar-cierre" data-id="${h.id}">Sí, borrar cierre</button></div>`;
      if (!$("dlgConfirmar").open) $("dlgConfirmar").showModal();
    },
    "si-borrar-cierre": async (d, el) => {
      el.disabled = true;
      try { await api("DELETE", `${BASE}/api/caja/turnos/${d.id}`); $("dlgConfirmar").close(); toast("Cierre borrado"); vistaCaja(); }
      catch (e) { el.disabled = false; throw e; }
    },
    "nueva-cat": () => formCategoria(),
    "editar-cat": (d) => formCategoria(estado.menu.find((c) => c.id == d.id)),
    "borrar-cat": async (d) => {
      if (!confirm("¿Eliminar la categoría y TODOS sus productos? Las ventas ya registradas no se modifican.")) return;
      await api("DELETE", `${BASE}/api/categorias/${d.id}`); $("dlgForm").close(); toast("Categoría eliminada"); vistaMenu();
    },
    "nuevo-prod": (d) => formProducto(null, Number(d.id)),
    "editar-prod": (d) => formProducto(estado.menu.flatMap((c) => c.productos).find((p) => p.id == d.id)),
    "borrar-prod": async (d) => {
      if (!confirm("¿Eliminar este producto? Si solo se acabó, mejor destildá \"Disponible\".")) return;
      await api("DELETE", `${BASE}/api/productos/${d.id}`); $("dlgForm").close(); toast("Producto eliminado"); vistaMenu();
    },
    "quitar-foto": () => { $("imgUrl").value = ""; $("prev").hidden = true; },
    "imprimir-qr": async () => { if (!estado.qr) await pintarQR(); imprimir(`<h2 style="font-family:sans-serif;text-align:center">${esc(estado.ajustes.nombre_local)} · Escaneá y pedí desde tu mesa</h2><div class="qr-grid">${qrHtml()}</div>`); },
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-a]"); if (!el) return;
    const fn = acciones[el.dataset.a];
    if (fn) seguro(fn)(el.dataset, el);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "bMenu") { estado.bMenu = e.target.value; pintarListaMenu(); }
    if (e.target.id === "bProd") { estado.busqueda = e.target.value; pintarAgregar(); }
    if (e.target.id === "cDesc" || e.target.id === "cRec") actualizarCobro();
  });
  $("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) ir(b.dataset.vista); });
  $("avisoSonido").onclick = desbloquear;
  // Un cuadro abierto (cobrar, ticket, editar...) solo se cierra con su X: ni tocando afuera por error ni con Esc
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("cancel", (e) => e.preventDefault()));
  $("dlgPedido").addEventListener("close", () => { estado.editandoId = null; });

  // ---------- Tiempo real ----------
  async function alegarPedidoNuevo(ev) {
    beep();
    toast(ev.delivery ? "🛵 Nuevo pedido de DELIVERY" : `🍽️ Nuevo pedido en la Mesa ${ev.mesa}`);
    if (estado.autoImprimir && ev.pedidoId) {
      const { pedido } = await api("GET", `${BASE}/api/pedidos/${ev.pedidoId}`);
      const nuevos = pedido.items.filter((i) => (ev.itemIds || []).includes(i.id));
      if (nuevos.length) imprimir(comandaHtml(pedido, nuevos, true));
    }
  }
  function conectar() {
    const es = new EventSource(BASE + "/api/eventos");
    es.onmessage = seguro(async (e) => {
      const ev = JSON.parse(e.data);
      if (ev.tipo === "pedido") await alegarPedidoNuevo(ev);
      else if (ev.tipo === "aviso") { beep(); toast(`🔔 La Mesa ${ev.mesa} te llama`); }
      await cargarActivos();
    });
  }

  (async () => {
    estado.ajustes = (await api("GET", BASE + "/api/ajustes").catch(() => ({ ajustes: null }))).ajustes;
    if (estado.ajustes) $("nombreLocal").textContent = estado.ajustes.nombre_local;
    ir("pedidos"); conectar(); revisarSonido();
    // Respaldo por si se cae la conexión en vivo + recordatorio sonoro mientras haya algo sin ver
    setInterval(() => { if (!document.hidden) seguro(cargarActivos)(); }, 20000);
    setInterval(() => { if (estado.pedidos.some((p) => p.sinVer || p.aviso)) beep(); }, 30000);
    setInterval(() => { if (estado.vista === "pedidos" && !document.hidden) pintarPedidos(); }, 60000); // actualiza los "hace X min"
  })();
})();
