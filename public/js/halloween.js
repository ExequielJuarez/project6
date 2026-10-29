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
  const MURCIELAGO = `<svg viewBox="0 0 64 32" aria-hidden="true"><path d="M29 9l-1.5-6 3.5 4h2l3.5-4L35 9c3-1 7-4 12-3 7 1 13 5 17 12-5-3-9-2-12 1-3-3-7-2-9 1-2-3-5-3-7 1l-3 6-3-6c-2-4-5-4-7-1-2-3-6-4-9-1-3-3-7-4-12-1 4-7 10-11 17-12 5-1 9 2 12 3z"/></svg>`;
  function volarMurcielago() {
    if (!visible()) return;
    const el = document.createElement("div");
    el.className = "murcielago";
    el.innerHTML = MURCIELAGO;
    const ancho = innerWidth, alto = innerHeight;
    const escala = rnd(.7, 1.3); el.style.width = 46 * escala + "px";
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
  const ARANA = `<span class="hilo"></span><svg viewBox="0 0 28 28" aria-hidden="true"><g class="patas"><path d="M14 14L5 6M14 14L3 11M14 14L3 17M14 14L5 22M14 14L23 6M14 14L25 11M14 14L25 17M14 14L23 22"/></g><ellipse class="cuerpo" cx="13" cy="14" rx="6" ry="5"/><circle class="cuerpo" cx="20" cy="14" r="3"/></svg>`;
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
