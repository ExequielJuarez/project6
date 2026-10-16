# Street Burger · Menú por mesa + panel de administración

Node.js + Express + MySQL (Sequelize) + EJS. Funciona en celular, tablet y PC.

## Cómo funciona

**Cliente** (`/`): arriba elige **En mesa** o **Delivery**.
- *En mesa*: la mesa **se fija escaneando el QR de la mesa** (no se puede elegir a mano: cada QR lleva un código secreto, así nadie pide en una mesa en la que no está). Arma el pedido y lo envía. Puede volver a pedir, ver su cuenta, pedir la cuenta o llamar al mozo.
- *Delivery*: arma el pedido y deja nombre, WhatsApp, dirección, referencias y cómo paga (efectivo —con cuánto abona— o transferencia). Si elige transferencia ve tus datos bancarios.

**Administrador** (`/admin`, con contraseña) — pensado para que solo llegue el pedido y se atienda:
- **Pedidos**: pantalla en vivo con **Mesas** de un lado (número de mesa bien grande) y **Delivery** del otro (con nombre, WhatsApp, dirección y forma de pago). **Suena** cuando entra un pedido y puede **imprimir solo** la comanda (solo lo nuevo de cada ronda). Los cuadros (cobrar, ticket, editar…) **solo se cierran con la X**, no al tocar afuera por error. Cuando la mesa se va (*Cobrar y cerrar*) o el delivery sale (*Despachar*), el pedido **desaparece de la pantalla** y pasa a Ventas: nunca se mezcla con clientes que ya se fueron.
- **Ventas**: lo cobrado/despachado, por día (hoy, semana y mes arriba), con el método de pago de cada una y el ticket para reimprimir.
- **Menú**: categorías y productos (precio, foto, pausar si se acabó). Cada categoría tiene su **foto**: los productos sin foto propia usan la de su categoría (por eso todas las hamburguesas muestran la misma). Podés subir una foto distinta a un producto cuando quieras.
- **Caja** (obligatoria): al entrar a Pedidos, si la caja está cerrada aparece un cuadro que **no se puede saltear** para abrirla con el efectivo inicial; sin caja abierta no se puede cobrar ni despachar. También tiene ingresos/egresos y arqueo al cerrar.
- **Ajustes**: nombre, cantidad de mesas, costo de envío, tiempo estimado de entrega, dirección del local, datos de transferencia, pausar pedidos/delivery y **QR por mesa**.

> El "día" de negocio va de 5:00 a 5:00 (las ventas de la 1 am cuentan para el día anterior): `HORA_CORTE_DIA` en el `.env`.

**Sonido e impresión automática:** los navegadores exigen un toque en la página para activar el audio (el panel te lo avisa). La impresión automática abre el cuadro de impresión de Chrome en cada pedido; para que imprima **sin preguntar**, abrí Chrome con `--kiosk-printing` (y poné tu impresora térmica como predeterminada).

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completá DB_*, ADMIN_PASSWORD y SESSION_SECRET
# (la base de datos se crea sola si no existe)
npm run db:instalar         # crea la base, las tablas y carga un menú de ejemplo
npm start                   # http://localhost:3000   ·   panel: /admin
```

- Si ya tenías la base de una versión anterior, **no hace falta reinstalar**: al arrancar el servidor agrega solo las columnas nuevas (delivery) sin borrar nada.
- `npm run db:instalar -- --reset` borra todo y empieza de cero.
- En producción usá `npm run prod` (sin nodemon), HTTPS, y `COOKIE_SECURE=true` (+ `TRUST_PROXY=true` si hay proxy).
- La carta real (nombres, descripciones y precios) está en `database/menu-real.js`, transcripta de las fotos de `docs/carta-original/`. `npm run db:instalar` la carga la primera vez. Para **reemplazar el menú de la base por esa carta** (y borrar los datos de prueba) usá `npm run db:menu -- --limpiar-pedidos` (sin `--limpiar-pedidos` solo cambia el menú). Después los precios se editan desde **Admin → Menú**.

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
