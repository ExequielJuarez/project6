// Halloween: telarañas, murciélagos que cruzan de vez en cuando y una arañita que camina por los títulos.
// Todo es decorativo (no intercepta toques) y se frena si la pestaña está oculta o la persona pide menos movimiento.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const visible = () => !document.hidden;

  // ---- Telarañas en las esquinas del encabezado ----
  const TELA = `<svg class="tela %C%" viewBox="0 0 92 92" aria-hidden="true"><path d="M0 0L92 0M0 0L84 40M0 0L62 70M0 0L36 86M0 0L0 92M14 0Q12 12 0 14M32 0Q28 28 0 32M52 0Q44 44 0 52M74 0Q62 62 0 74"/></svg>`;
  const cab = document.querySelector(".cab");
  if (cab) { cab.insertAdjacentHTML("afterbegin", TELA.replace("%C%", "izq") + TELA.replace("%C%", "der")); }

  // ---- Murciélagos ----
  // Murciélago: cuerpo + dos alas con membrana recortada y "dedos"; las alas aletean de forma independiente
  const ALA = `<path d="M0 0C6-9 20-17 44-14C40-9 38-5 36 0C35-4 30-4 27 1C25-3 20-2 17 4C14 0 9 1 6 6C4 4 2 5 0 8Z"/><path class="hueso" d="M0 0L44-14M0 0L36 0M0 0L27 1M0 0L17 4"/>`;
  const MURCIELAGO = `<svg viewBox="0 0 100 44" aria-hidden="true">
    <g class="ala"><g transform="translate(52 20)">${ALA}</g></g>
    <g transform="translate(100 0) scale(-1 1)"><g class="ala"><g transform="translate(52 20)">${ALA}</g></g></g>
    <path d="M46 14L44.5 5L49 10.5ZM54 14L55.5 5L51 10.5Z"/><ellipse cx="50" cy="26" rx="4.6" ry="9"/><circle cx="50" cy="16" r="4.2"/>
    <path d="M47.5 34L46 39M52.5 34L54 39" class="hueso"/></svg>`;
  function volarMurcielago() {
    if (!visible()) return;
    const el = document.createElement("div");
    el.className = "murcielago";
    el.innerHTML = MURCIELAGO;
    const ancho = innerWidth, alto = innerHeight;
    const escala = rnd(.7, 1.35); el.style.width = 64 * escala + "px";
    el.style.opacity = escala < .95 ? .6 : .92;               // los más chicos parecen estar más lejos
    el.style.setProperty("--aleteo", rnd(.22, .34).toFixed(2) + "s");
    const izqDer = Math.random() < .5;
    const y0 = rnd(alto * .12, alto * .65), ampl = rnd(18, 55), ciclos = rnd(1.5, 3);
    const pasos = 18, marcos = [];
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos, x = -80 + (ancho + 160) * (izqDer ? t : 1 - t);
      marcos.push({ transform: `translate(${x}px, ${y0 + Math.sin(t * ciclos * Math.PI * 2) * ampl - t * rnd(0, 40)}px) scaleX(${izqDer ? 1 : -1})` });
    }
    document.body.appendChild(el);
    const anim = el.animate(marcos, { duration: rnd(6500, 10000), easing: "linear" });
    anim.onfinish = () => el.remove();
  }
  (function programarMurcielagos(espera) {
    setTimeout(() => { volarMurcielago(); if (Math.random() < .3) setTimeout(volarMurcielago, rnd(500, 1500)); programarMurcielagos(rnd(9000, 17000)); }, espera);
  })(3500);

  // ---- Arañita: baja por un hilo, camina sobre las letras de un título y vuelve a subir ----
  // Araña vista desde arriba: abdomen con marca, cefalotórax con ojos y 8 patas articuladas que caminan alternadas
  const PATAS_A = "M29 18L34 11L38 8M25 17L22 8L17 4M27 22L29 32L28 37M23 22L15 30L8 31";
  const PATAS_B = "M27 17L29 8L28 3M23 18L15 10L8 9M29 22L34 29L38 32M25 23L22 32L17 36";
  const ARANA = `<span class="hilo"></span><svg viewBox="0 0 42 40" aria-hidden="true">
    <g class="patas pa"><path d="${PATAS_A}"/></g><g class="patas pb"><path d="${PATAS_B}"/></g>
    <ellipse class="cuerpo" cx="15" cy="20" rx="10" ry="7.5"/><ellipse class="marca" cx="14" cy="20" rx="3.4" ry="2.2"/>
    <ellipse class="cuerpo" cx="27" cy="20" rx="5.4" ry="4.4"/><circle class="ojo" cx="31" cy="18.6" r=".9"/><circle class="ojo" cx="31" cy="21.4" r=".9"/></svg>`;
  let caminando = false;
  function aranaCamina() {
    if (caminando || !visible() || document.querySelector("dialog[open]")) return false;
    const titulos = [...document.querySelectorAll(".categoria h2, .prod h3")].filter((h) => {
      const r = h.getBoundingClientRect();
      return h.offsetParent && r.top > 130 && r.bottom < innerHeight - 100;
    });
    if (!titulos.length) return false;
    const h = titulos[Math.floor(Math.random() * titulos.length)];
    const rango = document.createRange(); rango.selectNodeContents(h);
    const t = rango.getBoundingClientRect(), r = h.getBoundingClientRect();
    if (t.width < 40) return false;
    caminando = true;
    const el = document.createElement("div");
    el.className = "arana"; el.innerHTML = ARANA;
    const x0 = t.left + scrollX - 6, x1 = t.right + scrollX - 22;
    const y = r.top + scrollY + r.height / 2 - 16;
    el.style.left = "0"; el.style.top = "0";
    document.body.appendChild(el);
    const pos = (x, dy) => `translate(${x}px, ${y + dy}px)`;
    const fin = () => { el.remove(); caminando = false; };
    const hilo = el.querySelector(".hilo");
    const baja = el.animate([{ transform: pos(x0, -140), opacity: 1 }, { transform: pos(x0, 0), opacity: 1 }], { duration: 1200, easing: "ease-out", fill: "forwards" });
    baja.onfinish = () => {
      hilo.style.display = "none";
      const anda = el.animate([{ transform: pos(x0, 0) }, { transform: pos(x1, 0) }], { duration: Math.max(3000, (x1 - x0) * 28), easing: "linear", fill: "forwards" });
      anda.onfinish = () => {
        hilo.style.display = "";
        const sube = el.animate([{ transform: pos(x1, 0), opacity: 1 }, { transform: pos(x1, -160), opacity: 0 }], { duration: 1400, easing: "ease-in", fill: "forwards" });
        sube.onfinish = fin;
      };
    };
    return true;
  }
  // Si en ese momento no hay un título a la vista, reintenta enseguida
  (function programarArana(espera) { setTimeout(() => programarArana(aranaCamina() === false ? 2500 : rnd(16000, 28000)), espera); })(6000);
})();
