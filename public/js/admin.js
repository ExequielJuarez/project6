// Panel de administración: mesas en vivo, menú, caja, ganancias, historial y ajustes.
(() => {
  const $ = (id) => document.getElementById(id);
  const pesos = (n) => "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", mercadopago: "Mercado Pago" };
  const hora = (f) => new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fechaHora = (f) => new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const hace = (f) => { const m = Math.max(0, Math.round((Date.now() - new Date(f)) / 60000)); return m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`; };
  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const estado = { ajustes: null, mesas: [], caja: false, vista: "mesas", mesaAbierta: null, nuevos: new Set(), stage: {}, menu: [], rep: { grupo: "dia", clave: null }, sonido: leer("sb_sonido", true) };

  // ---------- Utilidades ----------
  function toast(txt, error) {
    const t = $("toast"); t.textContent = txt; t.className = "toast" + (error ? " err" : ""); t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), error ? 4500 : 2200);
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
  // Ejecuta una acción mostrando el error como aviso en vez de romper la pantalla
  const seguro = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };
  const num = (v) => (v === "" || v == null ? NaN : Number(String(v).replace(",", ".")));

  function beep() {
    if (!estado.sonido) return;
    try {
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      [[880, 0], [1175, 0.16]].forEach(([f, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = "sine"; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.3);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.32);
      });
    } catch {}
  }
  document.addEventListener("pointerdown", () => { try { beep.ctx?.resume(); } catch {} }, { once: true });

  function imprimir(html) {
    $("zonaImpresion").innerHTML = html;
    window.print();
  }

  // ---------- Navegación ----------
  const vistas = { mesas: vistaMesas, menu: vistaMenu, caja: vistaCaja, ganancias: vistaGanancias, historial: vistaHistorial, ajustes: vistaAjustes };
  function ir(v) {
    estado.vista = v;
    document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("activa", b.dataset.vista === v));
    document.querySelectorAll(".vista").forEach((s) => (s.hidden = s.id !== `vista-${v}`));
    seguro(vistas[v])();
  }

  // ---------- MESAS ----------
  async function vistaMesas() { await cargarMesas(); }

  async function cargarMesas() {
    const j = await api("GET", "/admin/api/mesas");
    estado.mesas = j.mesas; estado.caja = j.caja;
    const sinVer = j.mesas.filter((m) => m.sinVer || m.aviso).length;
    $("pastillaMesas").hidden = !sinVer; $("pastillaMesas").textContent = sinVer;
    document.title = (sinVer ? `(${sinVer}) ` : "") + "Panel · Street Burger";
    if (estado.vista === "mesas") pintarMesas();
  }

  function pintarMesas() {
    const ocupadas = estado.mesas.filter((m) => m.pedidoId);
    const porCobrar = ocupadas.reduce((s, m) => s + m.total, 0);
    $("vista-mesas").innerHTML = `
      <div class="titulo-vista"><h2>Mesas</h2><span class="suave">${ocupadas.length} ocupada(s) · por cobrar ${pesos(porCobrar)}</span></div>
      ${estado.caja ? "" : `<div class="banner"><span>💵 La caja está cerrada. Abrila para poder cobrar mesas.</span><button class="btn btn-acento btn-chico" data-a="ir" data-v="caja">Ir a Caja</button></div>`}
      <div class="grilla-mesas">${estado.mesas.filter((m) => !m.fueraDeRango || m.pedidoId).map((m) => `
        <button class="mesa ${m.pedidoId ? "ocupada" : ""} ${m.sinVer || m.aviso ? "nuevo" : ""}" data-a="mesa" data-n="${m.mesa}">
          <div class="insignias">${m.sinVer ? `<span class="ins">NUEVO</span>` : ""}${m.aviso === "cuenta" ? `<span class="ins aviso">🧾 PIDE CUENTA</span>` : m.aviso === "mozo" ? `<span class="ins aviso">🙋 LLAMA</span>` : ""}</div>
          <div class="num">${m.mesa}</div>
          <div class="estado">${m.pedidoId ? "Ocupada" : "Libre"}</div>
          ${m.pedidoId ? `<div class="monto">${pesos(m.total)}</div><div class="det">${m.productos} producto(s) · ${hace(m.desde)}</div>` : ""}
        </button>`).join("")}</div>`;
  }

  async function abrirMesa(n) {
    estado.mesaAbierta = n; estado.nuevos = new Set();
    await pintarMesaAbierta();
    if (!$("dlgMesa").open) $("dlgMesa").showModal();
  }
  async function pintarMesaAbierta() {
    const n = estado.mesaAbierta;
    const { pedido } = await api("GET", `/admin/api/mesas/${n}`);
    estado.pedido = pedido;
    let marcar = false;
    if (pedido) {
      pedido.items.filter((i) => !i.visto).forEach((i) => { estado.nuevos.add(i.id); marcar = true; });
      if (pedido.aviso) marcar = true;
    }
    const aviso = pedido?.aviso;
    $("dlgMesa").innerHTML = `
      <div class="dlg-cab"><h2>Mesa ${n}</h2><button class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      ${aviso ? `<div class="banner">${aviso === "cuenta" ? "🧾 El cliente pidió la cuenta" : "🙋 El cliente llama al mozo"}</div>` : ""}
      ${!pedido ? `<p class="vacio">Mesa libre. Agregá productos para abrir una cuenta.</p>` : `
      <div class="lineas">${pedido.items.map((i) => `
        <div class="linea ${estado.nuevos.has(i.id) ? "nuevo" : ""}">
          <div class="nombre">${esc(i.nombre)}${estado.nuevos.has(i.id) ? '<span class="etq nuevo">NUEVO</span>' : ""}${i.origen === "admin" ? '<span class="etq">MOZO</span>' : ""}</div>
          <div class="paso"><button data-a="cant" data-id="${i.id}" data-c="${i.cantidad - 1}" aria-label="Quitar uno">−</button><span>${i.cantidad}</span><button data-a="cant" data-id="${i.id}" data-c="${i.cantidad + 1}" aria-label="Agregar uno">+</button></div>
          <div class="importe">${pesos(i.precio * i.cantidad)}</div>
          ${i.nota ? `<div class="nota">📝 ${esc(i.nota)}</div>` : ""}
        </div>`).join("")}</div>
      <div class="totales">
        ${pedido.descuento > 0 ? `<div class="t"><span>Subtotal</span><span>${pesos(pedido.subtotal)}</span></div><div class="t"><span>Descuento</span><span>− ${pesos(pedido.descuento)}</span></div>` : ""}
        <div class="t grande"><span>Total</span><span>${pesos(pedido.total)}</span></div>
      </div>`}
      <div class="acciones">
        <button class="btn" data-a="agregar">＋ Agregar producto</button>
        ${pedido ? `<button class="btn btn-principal" data-a="cobrar">Cobrar y cerrar mesa</button><button class="btn btn-peligro btn-chico" data-a="cancelar-pedido">Cancelar pedido</button>` : ""}
      </div>`;
    if (marcar) { await api("POST", `/admin/api/pedidos/${pedido.id}/visto`); cargarMesas().catch(() => {}); }
  }

  // ----- Agregar productos a una cuenta -----
  async function abrirAgregar() {
    if (!estado.menu.length) estado.menu = (await api("GET", "/admin/api/menu")).categorias;
    estado.stage = {}; estado.filtroCat = null; estado.busqueda = "";
    pintarAgregar(); $("dlgAgregar").showModal();
  }
  function pintarAgregar() {
    const cats = estado.menu.filter((c) => c.activo && c.productos.some((p) => p.activo));
    const q = (estado.busqueda || "").toLowerCase();
    const prods = cats.filter((c) => !estado.filtroCat || c.id === estado.filtroCat).flatMap((c) => c.productos.filter((p) => p.activo && (!q || p.nombre.toLowerCase().includes(q))));
    const stage = Object.entries(estado.stage);
    const todos = estado.menu.flatMap((c) => c.productos);
    const nombre = (id) => todos.find((p) => p.id == id)?.nombre;
    const total = stage.reduce((s, [id, c]) => s + todos.find((p) => p.id == id).precio * c, 0);
    const buscando = document.activeElement?.id === "bProd";
    $("dlgAgregar").innerHTML = `
      <div class="dlg-cab"><h2>Agregar a Mesa ${estado.mesaAbierta}</h2><button class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      <div class="buscar"><input id="bProd" type="search" placeholder="Buscar producto…" value="${esc(estado.busqueda || "")}">
        <div class="chips"><button class="chip ${!estado.filtroCat ? "sel" : ""}" data-a="filtro" data-id="">Todos</button>${cats.map((c) => `<button class="chip ${estado.filtroCat === c.id ? "sel" : ""}" data-a="filtro" data-id="${c.id}">${c.icono} ${esc(c.nombre)}</button>`).join("")}</div></div>
      <div class="opciones">${prods.map((p) => `<button class="opcion" data-a="stage" data-id="${p.id}"><b>${esc(p.nombre)}</b><span>${pesos(p.precio)}</span>${estado.stage[p.id] ? `<i class="cuenta" style="font-style:normal">${estado.stage[p.id]}</i>` : ""}</button>`).join("") || '<p class="vacio">Sin resultados</p>'}</div>
      ${stage.length ? `<div style="margin-top:14px;border-top:2px solid var(--tinta);padding-top:10px">
        ${stage.map(([id, c]) => `<div class="linea" style="grid-template-columns:1fr auto"><div class="nombre">${esc(nombre(id))}</div><div class="paso"><button data-a="stage-menos" data-id="${id}">−</button><span>${c}</span><button data-a="stage" data-id="${id}">+</button></div></div>`).join("")}
        <button class="btn btn-principal" style="width:100%;margin-top:10px" data-a="confirmar-agregar">Agregar a la cuenta · ${pesos(total)}</button></div>` : ""}`;
    if (buscando) { const i = $("bProd"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  // ----- Cobrar -----
  function abrirCobro() {
    const p = estado.pedido;
    estado.cobro = { metodo: "efectivo", descuento: p.descuento || 0, recibido: "" };
    $("dlgCobro").innerHTML = `
      <div class="dlg-cab"><h2>Cobrar · Mesa ${p.mesa}</h2><button class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>
      <div class="totales"><div class="t"><span>Subtotal</span><b>${pesos(p.subtotal)}</b></div></div>
      <label class="campo"><span>Descuento ($)</span><input id="cDesc" type="number" inputmode="decimal" min="0" step="any" value="${estado.cobro.descuento || ""}" placeholder="0">
        <div class="rapidos">${[5, 10, 15, 20].map((x) => `<button type="button" class="chip" data-a="pct" data-p="${x}">${x}%</button>`).join("")}<button type="button" class="chip" data-a="pct" data-p="0">Sin descuento</button></div></label>
      <div class="totales"><div class="t grande"><span>Total a cobrar</span><span id="cTotal"></span></div></div>
      <div class="metodos">${Object.entries(METODOS).map(([k, v]) => `<button type="button" class="metodo ${k === "efectivo" ? "sel" : ""}" data-a="metodo" data-m="${k}">${{ efectivo: "💵", tarjeta: "💳", transferencia: "🏦", mercadopago: "📱" }[k]} ${v}</button>`).join("")}</div>
      <div id="cEfectivo"><label class="campo"><span>Efectivo recibido <small>(opcional, para calcular el vuelto)</small></span><input id="cRec" type="number" inputmode="decimal" min="0" step="any" placeholder="0">
        <div class="rapidos" id="cRapidos"></div></label><div id="cVuelto"></div></div>
      <div class="acciones"><button class="btn btn-principal" data-a="confirmar-cobro" id="btnCobrar" style="flex:1">Confirmar cobro y cerrar mesa</button></div>`;
    actualizarCobro(); $("dlgCobro").showModal();
  }
  function actualizarCobro() {
    const p = estado.pedido, c = estado.cobro;
    c.descuento = Math.min(Math.max(num($("cDesc").value) || 0, 0), p.subtotal);
    c.recibido = $("cRec") ? $("cRec").value : "";
    const total = Math.round((p.subtotal - c.descuento) * 100) / 100;
    $("cTotal").textContent = pesos(total);
    $("cEfectivo").hidden = c.metodo !== "efectivo";
    document.querySelectorAll(".metodo").forEach((b) => b.classList.toggle("sel", b.dataset.m === c.metodo));
    const redondeos = [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000])].filter((x) => x >= total).slice(0, 4);
    $("cRapidos").innerHTML = redondeos.map((x) => `<button type="button" class="chip" data-a="recibido" data-v="${x}">${x === total ? "Justo" : pesos(x)}</button>`).join("");
    const rec = num(c.recibido);
    $("cVuelto").innerHTML = Number.isFinite(rec) ? (rec >= total ? `<div class="vuelto"><span>Vuelto</span><span>${pesos(rec - total)}</span></div>` : `<div class="vuelto mal"><span>Falta</span><span>${pesos(total - rec)}</span></div>`) : "";
    c.total = total;
  }

  function ticketHtml(p) {
    const nombre = estado.ajustes?.nombre_local || "Street Burger";
    const ahora = p.cerrado_en || new Date();
    return `<div class="ticket">
      <div class="c"><h3>${esc(nombre)}</h3><div>Coffee &amp; Burgers</div></div><hr>
      <div class="f"><span>Ticket N° ${String(p.numero_ticket || 0).padStart(4, "0")}</span><span>Mesa ${p.mesa}</span></div>
      <div>${fechaHora(ahora)}</div><hr>
      ${p.resumen.map((r) => `<div class="it"><div class="f"><span>${r.cantidad} x ${esc(r.nombre)}</span><span>${pesos(r.subtotal)}</span></div>${r.nota ? `<small>${esc(r.nota)}</small>` : ""}</div>`).join("")}<hr>
      ${p.descuento > 0 ? `<div class="f"><span>Subtotal</span><span>${pesos(p.subtotal)}</span></div><div class="f"><span>Descuento</span><span>-${pesos(p.descuento)}</span></div>` : ""}
      <div class="f tot"><span>TOTAL</span><span>${pesos(p.total)}</span></div>
      <div class="f"><span>Pago</span><span>${METODOS[p.metodo_pago] || "-"}</span></div>
      ${p.recibido ? `<div class="f"><span>Recibido</span><span>${pesos(p.recibido)}</span></div><div class="f"><span>Vuelto</span><span>${pesos(p.recibido - p.total)}</span></div>` : ""}
      <hr><div class="c">¡Gracias por tu visita!<br>Buena comida, mejores momentos<br><small>Documento no válido como factura</small></div></div>`;
  }
  function mostrarTicket(p, cierraTodo) {
    estado.ticket = p; estado.cierraTodo = cierraTodo;
    $("dlgTicket").innerHTML = `<div class="dlg-cab"><h2>${cierraTodo ? "✓ Mesa cerrada" : "Ticket"}</h2><button class="cerrar" data-a="cerrar-ticket" aria-label="Cerrar">✕</button></div>
      ${ticketHtml(p)}<div class="acciones"><button class="btn btn-principal" data-a="imprimir" style="flex:1">🖨️ Imprimir ticket</button><button class="btn" data-a="cerrar-ticket">${cierraTodo ? "Listo" : "Cerrar"}</button></div>`;
    if (!$("dlgTicket").open) $("dlgTicket").showModal();
  }

  // ---------- MENÚ ----------
  async function vistaMenu() {
    estado.menu = (await api("GET", "/admin/api/menu")).categorias;
    $("vista-menu").innerHTML = `<div class="titulo-vista"><h2>Menú</h2><div class="acciones"><button class="btn btn-acento" data-a="nueva-cat" style="border-color:var(--acento)">＋ Categoría</button></div></div>
      ${estado.menu.map((c) => `<div class="tarjeta cat-admin">
        <div class="cat-cab"><h3>${c.icono} ${esc(c.nombre)} ${c.activo ? "" : '<span class="etq">OCULTA</span>'}</h3>
          <button class="btn btn-chico" data-a="nuevo-prod" data-id="${c.id}">＋ Producto</button><button class="btn btn-chico" data-a="editar-cat" data-id="${c.id}">Editar</button></div>
        ${c.productos.map((p) => `<div class="prod-fila ${p.activo ? "" : "inactivo"}">
          <div class="mini">${p.imagen ? `<img src="${esc(p.imagen)}" alt="">` : c.icono}</div>
          <div><b>${esc(p.nombre)} ${p.activo ? "" : '<span class="etq">PAUSADO</span>'}</b><p class="suave">${esc(p.descripcion)}</p></div>
          <div class="importe">${pesos(p.precio)}</div>
          <div class="acciones"><button class="btn btn-chico" data-a="editar-prod" data-id="${p.id}">Editar</button></div></div>`).join("") || '<p class="suave">Sin productos todavía.</p>'}
      </div>`).join("") || '<p class="vacio">Todavía no cargaste categorías. Empezá creando una (ej: Hamburguesas).</p>'}`;
  }

  function abrirForm(titulo, cuerpo, alEnviar) {
    $("dlgForm").innerHTML = `<form id="formDlg"><div class="dlg-cab"><h2>${titulo}</h2><button type="button" class="cerrar" data-a="cerrar-dlg" aria-label="Cerrar">✕</button></div>${cuerpo}</form>`;
    $("formDlg").onsubmit = seguro(async (e) => { e.preventDefault(); await alEnviar(new FormData(e.target)); });
    if (!$("dlgForm").open) $("dlgForm").showModal();
  }
  function formCategoria(c) {
    abrirForm(c ? "Editar categoría" : "Nueva categoría", `
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="80" value="${esc(c?.nombre)}"></label>
      <div class="fila-campos"><label class="campo"><span>Ícono (emoji)</span><input name="icono" maxlength="8" value="${esc(c?.icono || "🍽️")}"></label>
      <label class="campo"><span>Orden</span><input name="orden" type="number" value="${c?.orden ?? estado.menu.length}"></label></div>
      <label class="campo"><input type="checkbox" name="activo" style="width:auto" ${c?.activo !== false ? "checked" : ""}> Visible en el menú</label>
      <div class="acciones"><button class="btn btn-principal" style="flex:1">Guardar</button>${c ? '<button type="button" class="btn btn-peligro" data-a="borrar-cat" data-id="' + c.id + '">Eliminar</button>' : ""}</div>`,
      async (fd) => {
        const body = { nombre: fd.get("nombre"), icono: fd.get("icono"), orden: fd.get("orden"), activo: fd.has("activo") };
        await api(c ? "PUT" : "POST", c ? `/admin/api/categorias/${c.id}` : "/admin/api/categorias", body);
        $("dlgForm").close(); toast("Categoría guardada"); vistaMenu();
      });
  }
  function formProducto(p, categoriaId) {
    abrirForm(p ? "Editar producto" : "Nuevo producto", `
      <label class="campo"><span>Nombre</span><input name="nombre" required maxlength="120" value="${esc(p?.nombre)}"></label>
      <label class="campo"><span>Descripción <small>(opcional)</small></span><textarea name="descripcion" rows="2" maxlength="300">${esc(p?.descripcion)}</textarea></label>
      <div class="fila-campos"><label class="campo"><span>Precio de venta ($)</span><input name="precio" type="number" inputmode="decimal" min="0" step="any" required value="${p?.precio ?? ""}"></label>
      <label class="campo"><span>Costo ($) <small>para calcular ganancia</small></span><input name="costo" type="number" inputmode="decimal" min="0" step="any" value="${p?.costo ?? ""}"></label></div>
      <label class="campo"><span>Categoría</span><select name="categoria_id">${estado.menu.map((c) => `<option value="${c.id}" ${(p?.categoria_id ?? categoriaId) == c.id ? "selected" : ""}>${c.icono} ${esc(c.nombre)}</option>`).join("")}</select></label>
      <div class="campo"><span>Foto <small>(opcional)</small></span>
        <img id="prev" class="vista-previa" alt="" ${p?.imagen ? `src="${esc(p.imagen)}"` : "hidden"}>
        <input type="hidden" name="imagen" id="imgUrl" value="${esc(p?.imagen)}"><input type="file" id="imgArchivo" accept="image/jpeg,image/png,image/webp">
        <button type="button" class="btn btn-chico" data-a="quitar-foto" style="margin-top:6px">Quitar foto</button></div>
      <label class="campo"><input type="checkbox" name="activo" style="width:auto" ${p?.activo !== false ? "checked" : ""}> Disponible (destildalo si se acabó)</label>
      <div class="acciones"><button class="btn btn-principal" style="flex:1">Guardar</button>${p ? '<button type="button" class="btn btn-peligro" data-a="borrar-prod" data-id="' + p.id + '">Eliminar</button>' : ""}</div>`,
      async (fd) => {
        const body = { nombre: fd.get("nombre"), descripcion: fd.get("descripcion"), precio: fd.get("precio"), costo: fd.get("costo") || 0, categoria_id: fd.get("categoria_id"), imagen: fd.get("imagen"), activo: fd.has("activo") };
        await api(p ? "PUT" : "POST", p ? `/admin/api/productos/${p.id}` : "/admin/api/productos", body);
        $("dlgForm").close(); toast("Producto guardado"); vistaMenu();
      });
    $("imgArchivo").onchange = seguro(async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const blob = await reducirImagen(f);
      const fd = new FormData(); fd.append("imagen", blob, "foto.jpg");
      const { url } = await api("POST", "/admin/api/imagenes", fd);
      $("imgUrl").value = url; $("prev").src = url; $("prev").hidden = false;
    });
  }
  // Achica la foto antes de subirla (los celulares sacan fotos enormes)
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

  // ---------- CAJA ----------
  async function vistaCaja() {
    const { actual, historial } = await api("GET", "/admin/api/caja");
    estado.caja = Boolean(actual);
    let html = `<div class="titulo-vista"><h2>Caja</h2></div>`;
    if (!actual) {
      html += `<div class="tarjeta"><h3>La caja está cerrada</h3><p class="suave">Abrí la caja indicando con cuánto efectivo empezás (el cambio). Mientras esté cerrada no se pueden cobrar mesas.</p>
        <form id="formAbrir"><label class="campo"><span>Efectivo inicial ($)</span><input name="monto" type="number" inputmode="decimal" min="0" step="any" required value="0"></label><button class="btn btn-principal">Abrir caja</button></form></div>`;
    } else {
      const t = actual.turno;
      html += `<p class="suave">Abierta desde ${fechaHora(t.creado_en)}</p>
        <div class="kpis">
          <div class="kpi oscuro"><small>Efectivo que debería haber</small><strong>${pesos(actual.esperado)}</strong><em>inicial + ventas en efectivo + ingresos − egresos</em></div>
          <div class="kpi"><small>Ventas del turno</small><strong>${pesos(actual.totalVentas)}</strong><em>${actual.pedidos} mesa(s) cobrada(s)</em></div>
          <div class="kpi"><small>Efectivo inicial</small><strong>${pesos(t.monto_inicial)}</strong></div>
          <div class="kpi"><small>Ingresos / Egresos</small><strong>${pesos(actual.ingresos)} / ${pesos(actual.egresos)}</strong></div>
        </div>
        <div class="dos-col"><div class="tarjeta"><h3>Ventas por método</h3>${Object.entries(METODOS).map(([k, v]) => `<div class="metodo-fila"><span>${v}</span><b>${pesos(actual.ventas[k])}</b></div>`).join("")}</div>
        <div class="tarjeta"><h3>Registrar movimiento</h3><form id="formMov">
          <div class="fila-campos"><label class="campo"><span>Tipo</span><select name="tipo"><option value="egreso">Egreso (sale plata)</option><option value="ingreso">Ingreso (entra plata)</option></select></label>
          <label class="campo"><span>Monto ($)</span><input name="monto" type="number" inputmode="decimal" min="0.01" step="any" required></label></div>
          <label class="campo"><span>Concepto</span><input name="concepto" required maxlength="150" placeholder="Ej: compra de pan, retiro, cambio…"></label>
          <button class="btn btn-principal">Registrar</button></form></div></div>
        <div class="tarjeta"><h3>Movimientos del turno</h3>${actual.movimientos.length ? `<table class="tabla"><tbody>${actual.movimientos.map((m) => `<tr><td>${hora(m.creado_en)}</td><td>${esc(m.concepto)}</td><td class="der ${m.tipo === "ingreso" ? "pos" : "neg"}">${m.tipo === "ingreso" ? "+" : "−"} ${pesos(m.monto)}</td></tr>`).join("")}</tbody></table>` : '<p class="suave">Sin movimientos.</p>'}</div>
        <div class="tarjeta"><h3>Cerrar caja</h3><p class="suave">Contá el efectivo que hay en el cajón. Se comparará con lo que debería haber.</p>
          <form id="formCerrar"><div class="fila-campos"><label class="campo"><span>Efectivo contado ($)</span><input name="contado" type="number" inputmode="decimal" min="0" step="any" required></label>
          <label class="campo"><span>Nota <small>(opcional)</small></span><input name="nota" maxlength="250"></label></div><button class="btn btn-peligro">Cerrar caja del día</button></form></div>`;
    }
    html += `<div class="tarjeta"><h3>Cierres anteriores</h3>${historial.length ? `<table class="tabla"><thead><tr><th>Cierre</th><th class="der">Ventas</th><th class="der">Esperado</th><th class="der">Contado</th><th class="der">Diferencia</th></tr></thead><tbody>${historial.map((h) => `<tr><td>${fechaHora(h.cerrado_en)}</td><td class="der">${pesos(h.totalVentas)}</td><td class="der">${pesos(h.monto_esperado)}</td><td class="der">${pesos(h.monto_contado)}</td><td class="der ${h.diferencia === 0 ? "" : h.diferencia > 0 ? "pos" : "neg"}">${h.diferencia > 0 ? "+" : ""}${pesos(h.diferencia)}</td></tr>`).join("")}</tbody></table>` : '<p class="suave">Todavía no cerraste ninguna caja.</p>'}</div>`;
    $("vista-caja").innerHTML = html;
    const f = (id, fn) => $(id) && ($(id).onsubmit = seguro(async (e) => { e.preventDefault(); await fn(Object.fromEntries(new FormData(e.target))); }));
    f("formAbrir", async (b) => { await api("POST", "/admin/api/caja/abrir", b); toast("Caja abierta"); vistaCaja(); });
    f("formMov", async (b) => { await api("POST", "/admin/api/caja/movimientos", b); toast("Movimiento registrado"); vistaCaja(); });
    f("formCerrar", async (b) => {
      if (!confirm("¿Cerrar la caja? Ya no se podrá cobrar hasta abrir una nueva.")) return;
      const { cierre } = await api("POST", "/admin/api/caja/cerrar", b);
      alert(`Caja cerrada.\n\nEsperado: ${pesos(cierre.esperado)}\nContado: ${pesos(cierre.turno.monto_contado)}\nDiferencia: ${cierre.diferencia > 0 ? "+" : ""}${pesos(cierre.diferencia)}`);
      vistaCaja();
    });
  }

  // ---------- GANANCIAS ----------
  async function vistaGanancias() {
    const r = await api("GET", `/admin/api/reportes?grupo=${estado.rep.grupo}${estado.rep.clave ? `&clave=${estado.rep.clave}` : ""}`);
    estado.rep.clave = r.clave;
    const k = (t, d, oscuro) => `<div class="kpi ${oscuro ? "oscuro" : ""}"><small>${t}</small><strong>${pesos(d.ventas)}</strong><em>${r.hayCostos ? `Ganancia ${pesos(d.ganancia)} · ` : ""}${d.pedidos} cuenta(s)</em></div>`;
    const max = Math.max(1, ...r.serie.map((s) => s.ventas));
    const nombreG = { dia: "día", semana: "semana", mes: "mes" }[r.grupo];
    $("vista-ganancias").innerHTML = `<div class="titulo-vista"><h2>Ganancias</h2></div>
      <div class="kpis">${k("Hoy", r.resumen.hoy, true)}${k("Esta semana", r.resumen.semana)}${k("Este mes", r.resumen.mes)}</div>
      ${r.hayCostos ? "" : `<div class="banner"><span>💡 Cargá el <b>costo</b> de tus productos (pestaña Menú) y vas a ver también la ganancia real, no solo lo vendido.</span></div>`}
      <div class="tarjeta"><div class="titulo-vista" style="margin-bottom:6px"><h3 style="margin:0">Ventas por ${nombreG}</h3>
        <div class="tabs">${[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([g, t]) => `<button data-a="grupo" data-g="${g}" class="${r.grupo === g ? "sel" : ""}">${t}</button>`).join("")}</div></div>
        <div class="grafico">${r.serie.map((s) => `<button class="col ${s.clave === r.clave ? "sel" : ""}" data-a="periodo" data-k="${s.clave}" title="${s.etiqueta}: ${pesos(s.ventas)}"><span class="val">${s.ventas ? pesos(s.ventas) : ""}</span><div class="barra-g" style="height:${Math.round((s.ventas / max) * 130)}px"></div><span class="et">${s.etiqueta}</span></button>`).join("")}</div></div>
      <div class="tarjeta"><h3>Detalle · ${esc(r.etiquetaClave)}</h3>
        <div class="kpis" style="margin-bottom:0"><div class="kpi" style="background:var(--latte)"><small>Ventas</small><strong>${pesos(r.detalle.ventas)}</strong></div>
          <div class="kpi" style="background:var(--latte)"><small>${r.hayCostos ? "Ganancia" : "Cuentas cobradas"}</small><strong>${r.hayCostos ? pesos(r.detalle.ganancia) : r.detalle.pedidos}</strong></div>
          <div class="kpi" style="background:var(--latte)"><small>Ticket promedio</small><strong>${pesos(r.detalle.ticketPromedio)}</strong><em>${r.detalle.pedidos} cuenta(s)</em></div>
          <div class="kpi" style="background:var(--latte)"><small>Descuentos</small><strong>${pesos(r.detalle.descuentos)}</strong></div></div></div>
      <div class="dos-col" style="margin-top:14px"><div class="tarjeta"><h3>Cobrado por método</h3>${Object.entries(METODOS).map(([m, v]) => `<div class="metodo-fila"><span>${v}</span><b>${pesos(r.detalle.porMetodo[m])}</b></div>`).join("")}</div>
        <div class="tarjeta"><h3>Lo más vendido</h3>${r.detalle.top.length ? r.detalle.top.map((t, i) => `<div class="metodo-fila"><span>${i + 1}. ${esc(t.nombre)}</span><b>${t.cantidad} u. · ${pesos(t.total)}</b></div>`).join("") : '<p class="suave">Sin ventas en este período.</p>'}</div></div>`;
    const g = document.querySelector(".grafico"); if (g) g.scrollLeft = g.scrollWidth; // arranca mostrando lo más reciente
  }

  // ---------- HISTORIAL ----------
  async function vistaHistorial(dia) {
    const j = await api("GET", `/admin/api/historial${dia ? `?dia=${dia}` : ""}`);
    const total = j.pedidos.reduce((s, p) => s + p.total, 0);
    $("vista-historial").innerHTML = `<div class="titulo-vista"><h2>Historial</h2><input id="diaH" type="date" value="${j.dia}" style="width:auto"></div>
      <div class="tarjeta"><p class="suave">${j.pedidos.length} cuenta(s) cobrada(s) · ${pesos(total)} <span>(el día de negocio va de 5:00 a 5:00)</span></p>
      ${j.pedidos.length ? `<table class="tabla"><thead><tr><th>Ticket</th><th>Mesa</th><th>Hora</th><th>Pago</th><th class="der">Total</th></tr></thead><tbody>${j.pedidos.map((p) => `<tr class="click" data-a="ver-ticket" data-id="${p.id}"><td>#${String(p.numero_ticket).padStart(4, "0")}</td><td>${p.mesa}</td><td>${hora(p.cerrado_en)}</td><td>${METODOS[p.metodo_pago]}</td><td class="der">${pesos(p.total)}</td></tr>`).join("")}</tbody></table><p class="suave">Tocá una fila para ver o reimprimir el ticket.</p>` : '<p class="vacio">No hay cobros en este día.</p>'}</div>`;
    $("diaH").onchange = (e) => e.target.value && seguro(vistaHistorial)(e.target.value);
  }

  // ---------- AJUSTES ----------
  async function vistaAjustes() {
    estado.ajustes = (await api("GET", "/admin/api/ajustes")).ajustes;
    const a = estado.ajustes;
    $("vista-ajustes").innerHTML = `<div class="titulo-vista"><h2>Ajustes</h2></div>
      <div class="tarjeta"><h3>El local</h3><form id="formAj">
        <label class="campo"><span>Nombre (sale en el ticket)</span><input name="nombre_local" required maxlength="60" value="${esc(a.nombre_local)}"></label>
        <label class="campo"><span>Cantidad de mesas</span><input name="cantidad_mesas" type="number" min="1" max="100" required value="${a.cantidad_mesas}"></label>
        <label class="campo"><input type="checkbox" name="recibir_pedidos" style="width:auto" ${a.recibir_pedidos ? "checked" : ""}> Recibir pedidos desde el celular de los clientes <small>(destildalo para pausarlos)</small></label>
        <button class="btn btn-principal">Guardar</button></form></div>
      <div class="tarjeta"><h3>QR de las mesas</h3>
        <p class="suave">Pegá el QR en cada mesa: el cliente lo escanea y entra al menú ya con su número de mesa elegido.${/localhost|127\.0\.0\.1/.test(location.hostname) ? ' <b style="color:var(--error)">Ahora estás en localhost: cuando publiques el sitio, volvé a esta pantalla desde tu dirección real para generar los QR correctos.</b>' : ""}</p>
        <div class="acciones" style="margin-bottom:12px"><button class="btn" data-a="imprimir-qr">🖨️ Imprimir QR de todas las mesas</button></div>
        <div class="qr-grid" id="qrGrid"></div></div>`;
    $("formAj").onsubmit = seguro(async (e) => {
      e.preventDefault(); const fd = new FormData(e.target);
      estado.ajustes = (await api("PUT", "/admin/api/ajustes", { nombre_local: fd.get("nombre_local"), cantidad_mesas: fd.get("cantidad_mesas"), recibir_pedidos: fd.has("recibir_pedidos") })).ajustes;
      toast("Ajustes guardados"); pintarQR();
    });
    pintarQR();
  }
  function qrSvg(url) {
    if (typeof qrcode === "undefined") return `<small>${esc(url)}</small>`;
    const q = qrcode(0, "M"); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  function qrHtml() {
    return Array.from({ length: estado.ajustes.cantidad_mesas }, (_, i) => `<div class="qr-item"><b>Mesa ${i + 1}</b>${qrSvg(`${location.origin}/?mesa=${i + 1}`)}</div>`).join("");
  }
  function pintarQR() { $("qrGrid").innerHTML = qrHtml(); }

  // ---------- Eventos de clicks ----------
  const acciones = {
    ir: (d) => ir(d.v),
    mesa: (d) => abrirMesa(Number(d.n)),
    "cerrar-dlg": (d, el) => { el.closest("dialog").close(); },
    cant: async (d) => { await api("PATCH", `/admin/api/items/${d.id}`, { cantidad: Number(d.c) }); await pintarMesaAbierta(); cargarMesas(); },
    agregar: () => abrirAgregar(),
    filtro: (d) => { estado.filtroCat = d.id ? Number(d.id) : null; pintarAgregar(); },
    stage: (d) => { estado.stage[d.id] = Math.min(20, (estado.stage[d.id] || 0) + 1); pintarAgregar(); },
    "stage-menos": (d) => { if (--estado.stage[d.id] <= 0) delete estado.stage[d.id]; pintarAgregar(); },
    "confirmar-agregar": async () => {
      const items = Object.entries(estado.stage).map(([productoId, cantidad]) => ({ productoId: Number(productoId), cantidad }));
      await api("POST", `/admin/api/mesas/${estado.mesaAbierta}/items`, { items });
      $("dlgAgregar").close(); toast("Agregado a la cuenta"); await pintarMesaAbierta(); cargarMesas();
    },
    cobrar: () => abrirCobro(),
    pct: (d) => { $("cDesc").value = Math.round(estado.pedido.subtotal * Number(d.p)) / 100 || ""; actualizarCobro(); },
    metodo: (d) => { estado.cobro.metodo = d.m; actualizarCobro(); },
    recibido: (d) => { $("cRec").value = d.v; actualizarCobro(); },
    "confirmar-cobro": async (d, el) => {
      const c = estado.cobro; el.disabled = true;
      try {
        const body = { metodo: c.metodo, descuento: c.descuento, recibido: c.metodo === "efectivo" && c.recibido !== "" ? c.recibido : undefined };
        const { pedido } = await api("POST", `/admin/api/pedidos/${estado.pedido.id}/cerrar`, body);
        $("dlgCobro").close(); $("dlgMesa").close(); estado.mesaAbierta = null;
        mostrarTicket(pedido, true); cargarMesas();
      } finally { el.disabled = false; }
    },
    "cancelar-pedido": async () => {
      if (!confirm(`¿Cancelar el pedido de la Mesa ${estado.mesaAbierta}? No se cobra ni queda registrado como venta.`)) return;
      await api("POST", `/admin/api/pedidos/${estado.pedido.id}/cancelar`);
      $("dlgMesa").close(); estado.mesaAbierta = null; toast("Pedido cancelado"); cargarMesas();
    },
    imprimir: () => imprimir(ticketHtml(estado.ticket)),
    "cerrar-ticket": () => $("dlgTicket").close(),
    "ver-ticket": async (d) => mostrarTicket((await api("GET", `/admin/api/pedidos/${d.id}`)).pedido, false),
    "nueva-cat": () => formCategoria(),
    "editar-cat": (d) => formCategoria(estado.menu.find((c) => c.id == d.id)),
    "borrar-cat": async (d) => {
      if (!confirm("¿Eliminar la categoría y TODOS sus productos? Las ventas ya registradas no se modifican.")) return;
      await api("DELETE", `/admin/api/categorias/${d.id}`); $("dlgForm").close(); toast("Categoría eliminada"); vistaMenu();
    },
    "nuevo-prod": (d) => formProducto(null, Number(d.id)),
    "editar-prod": (d) => formProducto(estado.menu.flatMap((c) => c.productos).find((p) => p.id == d.id)),
    "borrar-prod": async (d) => {
      if (!confirm("¿Eliminar este producto? Si solo se acabó, mejor destildá \"Disponible\".")) return;
      await api("DELETE", `/admin/api/productos/${d.id}`); $("dlgForm").close(); toast("Producto eliminado"); vistaMenu();
    },
    "quitar-foto": () => { $("imgUrl").value = ""; $("prev").hidden = true; },
    grupo: (d) => { estado.rep = { grupo: d.g, clave: null }; return vistaGanancias(); },
    periodo: (d) => { estado.rep.clave = d.k; return vistaGanancias(); },
    "imprimir-qr": () => imprimir(`<h2 style="font-family:sans-serif;text-align:center">${esc(estado.ajustes.nombre_local)} · Escaneá y pedí desde tu mesa</h2><div class="qr-grid">${qrHtml()}</div>`),
  };
  document.addEventListener("click", (e) => {
    if (e.target.tagName === "DIALOG") return e.target.close();
    const el = e.target.closest("[data-a]"); if (!el) return;
    const fn = acciones[el.dataset.a];
    if (fn) seguro(fn)(el.dataset, el);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "bProd") { estado.busqueda = e.target.value; pintarAgregar(); }
    if (e.target.id === "cDesc" || e.target.id === "cRec") actualizarCobro();
  });
  $("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) ir(b.dataset.vista); });
  $("btnSonido").textContent = estado.sonido ? "🔔" : "🔕";
  $("btnSonido").onclick = () => { estado.sonido = !estado.sonido; guardar("sb_sonido", estado.sonido); $("btnSonido").textContent = estado.sonido ? "🔔" : "🔕"; if (estado.sonido) beep(); };
  $("dlgMesa").addEventListener("close", () => { estado.mesaAbierta = null; });

  // ---------- Tiempo real ----------
  function conectar() {
    const es = new EventSource("/admin/api/eventos");
    es.onmessage = seguro(async (e) => {
      const ev = JSON.parse(e.data);
      if (ev.tipo === "pedido" || ev.tipo === "aviso") { beep(); toast(ev.tipo === "pedido" ? `🍽️ Nuevo pedido en la Mesa ${ev.mesa}` : `🔔 La Mesa ${ev.mesa} te llama`); }
      await cargarMesas();
      if (estado.mesaAbierta && $("dlgMesa").open && !$("dlgCobro").open) await pintarMesaAbierta();
    });
  }

  (async () => {
    estado.ajustes = (await api("GET", "/admin/api/ajustes").catch(() => ({ ajustes: null }))).ajustes;
    ir("mesas"); conectar();
    // Respaldo por si se cae la conexión en vivo
    setInterval(() => { if (!document.hidden) seguro(cargarMesas)(); }, 20000);
  })();
})();
