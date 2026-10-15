# Street Burger · Menú por mesa + panel de administración

Node.js + Express + MySQL (Sequelize) + EJS. Funciona en celular, tablet y PC.

## Cómo funciona

**Cliente** (`/`): elige su mesa (o escanea el QR de la mesa: `/?mesa=5`), arma el pedido con los productos del menú y lo envía. Puede volver a pedir, ver su cuenta, y pedir la cuenta o llamar al mozo.

**Administrador** (`/admin`, con contraseña): 
- **Mesas**: en vivo (con sonido y aviso) aparece qué mesa pidió y cuánto es. Abrís la mesa, agregás/quitás productos si el cliente pide algo más, y cuando va a pagar tocás **Cobrar y cerrar mesa** → elegís método de pago (efectivo con vuelto, tarjeta, transferencia, Mercado Pago), descuento opcional, y se genera el **ticket imprimible**. Una mesa solo se cierra cuando vos la cobrás; mientras tanto el cliente puede seguir pidiendo.
- **Menú**: categorías y productos (precio, costo opcional, foto, pausar si se acabó).
- **Caja**: abrir con efectivo inicial, ingresos/egresos, ventas por método, cierre con arqueo (esperado vs. contado). No se puede cobrar con la caja cerrada.
- **Ganancias**: por día, semana y mes (gráfico, ticket promedio, métodos de pago, lo más vendido). Si cargás el costo de cada producto, muestra la ganancia real.
- **Historial**: cobros por día y reimpresión de tickets.
- **Ajustes**: nombre del local, cantidad de mesas, pausar pedidos y **QR por mesa** imprimibles.

> El "día" de negocio va de 5:00 a 5:00, así las ventas de la 1 am cuentan para el día anterior (`HORA_CORTE_DIA` en el `.env`).

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completá DB_*, ADMIN_PASSWORD y SESSION_SECRET
# creá la base vacía en MySQL:  CREATE DATABASE cafeteria_db CHARACTER SET utf8mb4;
npm run db:instalar         # crea las tablas y carga un menú de ejemplo
npm start                   # http://localhost:3000   ·   panel: /admin
```

- `npm run db:instalar -- --reset` borra todo y empieza de cero.
- En producción usá `npm run prod` (sin nodemon), HTTPS, y `COOKIE_SECURE=true` (+ `TRUST_PROXY=true` si hay proxy).
- Los precios del menú de ejemplo son inventados: cambialos desde **Admin → Menú**.

## Estructura

```
src/app.js                      servidor
src/routes/index.Routes.js      menú y pedidos del cliente
src/routes/admin.Routes.js      login y API del panel (todo protegido)
src/services/                   pedidos, caja, reportes, menú, ajustes
src/model/database/models/      modelos Sequelize
src/views/cliente | admin       vistas EJS
public/                         css, js, imágenes (public/uploads = fotos de productos)
database/instalar.js            crea tablas y datos de ejemplo
```
