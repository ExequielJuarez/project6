// Parte pública: el menú que ven los clientes en su celular.
const express = require("express");
const menu = require("../services/menuService");
const ajustes = require("../services/ajusteService");
const pedidos = require("../services/pedidoService");
const limitador = require("../middlewares/limitador");
const { ErrorNegocio } = require("../helpers/errores");

const router = express.Router();
const limiteEscritura = limitador({ max: 30, ventanaMs: 60_000, mensaje: "Estás enviando muchos pedidos seguidos, esperá un momento." });

const numeroMesa = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new ErrorNegocio("Mesa inválida");
  return n;
};

router.get("/", async (req, res, next) => {
  try {
    const [categorias, config] = await Promise.all([menu.menuPublico(), ajustes.todos()]);
    res.render("cliente/menu", { categorias, config, mesaUrl: Number.parseInt(req.query.mesa) || null });
  } catch (e) { next(e); }
});

// Cuenta actual de una mesa (lo que ya pidió)
router.get("/api/mesas/:mesa/cuenta", async (req, res, next) => {
  try {
    const mesa = numeroMesa(req.params.mesa);
    await ajustes.validarMesa(mesa);
    const p = pedidos.aPlano(await pedidos.abiertoDeMesa(mesa));
    res.json({ ok: true, cuenta: p && { total: p.total, resumen: p.resumen, aviso: p.aviso } });
  } catch (e) { next(e); }
});

router.post("/api/pedidos", limiteEscritura, async (req, res, next) => {
  try {
    const config = await ajustes.todos();
    if (!config.recibir_pedidos) throw new ErrorNegocio("Por ahora no estamos tomando pedidos desde el celular. Pedile al mozo 🙂", 409);
    const p = await pedidos.agregarItems(numeroMesa(req.body.mesa), req.body.items, "cliente");
    res.json({ ok: true, mesa: p.mesa, total: p.total });
  } catch (e) { next(e); }
});

// Pedido de delivery: datos del cliente + productos
router.post("/api/delivery", limiteEscritura, async (req, res, next) => {
  try {
    const p = await pedidos.crearDelivery(req.body.cliente, req.body.items);
    const config = await ajustes.todos();
    res.json({ ok: true, numero: p.id, total: p.total, pago: p.pago_preferido, transferencia: p.pago_preferido === "transferencia" ? config.transferencia_info : "" });
  } catch (e) { next(e); }
});

router.post("/api/mesas/:mesa/aviso", limiteEscritura, async (req, res, next) => {
  try {
    const mesa = numeroMesa(req.params.mesa);
    await ajustes.validarMesa(mesa);
    await pedidos.avisar(mesa, req.body.tipo);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
