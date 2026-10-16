# Cómo subir Street Burger a un VPS de DonWeb

Guía paso a paso para un VPS con **Ubuntu 22.04 o 24.04** (el que DonWeb te instala por defecto).
Tiempo aproximado: 30–40 minutos. Todo lo que está en `código` se copia y pega en la terminal del servidor.

> **Qué vas a tener al final:** el menú de clientes en `https://tudominio.com`, el panel en `https://tudominio.com/admin`,
> HTTPS gratis (Let's Encrypt), el sitio siempre prendido (aunque se reinicie el servidor) y copias de seguridad diarias.

---

## 0. Qué necesitás antes de empezar

- El **VPS** de DonWeb con su **IP** y la contraseña de `root` (te la mandan por mail).
- Un **dominio** (puede ser el de DonWeb u otro). Sin dominio el sitio funciona por IP, pero **sin HTTPS** y el panel no va a dejarte entrar (ver "Problemas comunes").
- Este repositorio, rama **`deploy`**.

## 1. Apuntar el dominio al VPS

En el panel donde administrás tu dominio (en DonWeb: *Dominios → Administrar → Zona DNS*) creá estos registros:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `@` (o vacío) | la IP de tu VPS |
| A | `www` | la IP de tu VPS |

Puede tardar de unos minutos a unas horas en propagarse. Podés seguir con los pasos mientras tanto.

## 2. Entrar al servidor

Desde tu computadora (Windows: PowerShell; Mac/Linux: Terminal):

```bash
ssh root@LA_IP_DE_TU_VPS
```

## 3. Instalar lo necesario

```bash
apt update && apt upgrade -y
apt install -y git nginx ufw mariadb-server certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
timedatectl set-timezone America/Argentina/Buenos_Aires
```

Firewall (deja abierto solo SSH y la web):

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

## 4. Crear la base de datos

```bash
mysql_secure_installation     # contestá: Enter, n, Y, Y, Y, Y (o lo que prefieras; poné una clave de root)
mysql -u root -p
```

Dentro de MySQL (cambiá `CLAVE_LARGA_DE_LA_BASE` por una clave tuya y **anotala**):

```sql
CREATE DATABASE street_burger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'street_burger'@'localhost' IDENTIFIED BY 'CLAVE_LARGA_DE_LA_BASE';
GRANT ALL PRIVILEGES ON street_burger_db.* TO 'street_burger'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 5. Bajar el código

```bash
mkdir -p /var/www && cd /var/www
git clone -b deploy https://github.com/ExequielJuarez/project6.git street-burger
cd street-burger
```

Si el repositorio es **privado**, GitHub te va a pedir usuario y contraseña: como contraseña usá un **token**
(GitHub → Settings → Developer settings → Personal access tokens → *Tokens (classic)* → permiso `repo`).

Instalar las dependencias:

```bash
npm ci --omit=dev
```

## 6. Configurar (archivo `.env`)

```bash
cp .env.example .env
nano .env
```

Completá estas líneas (guardar en nano: `Ctrl+O`, Enter, `Ctrl+X`):

- `DB_PASSWORD=` → la `CLAVE_LARGA_DE_LA_BASE` del paso 4.
- `ADMIN_PASSWORD=` → **la contraseña con la que vas a entrar a /admin** (larga, tuya, no la compartas).
- `SESSION_SECRET=` → generá uno con este comando y pegá el resultado:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

El servidor **se niega a arrancar** si falta `SESSION_SECRET` o si la contraseña es débil/de ejemplo. Es a propósito.

## 7. Crear las tablas

```bash
npm run db:instalar
```

Crea las tablas y carga la **carta real** de Street Burger. Después podés cambiar precios y productos desde el panel → *Menú*.

## 8. Dejarlo prendido con PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

`pm2 startup` imprime **una línea que empieza con `sudo env PATH=...`**: copiala, pegala y ejecutala. Así el sitio arranca solo cuando se reinicia el servidor.

Verificá: `curl http://localhost:3000/salud` → tiene que responder `{"ok":true}`.

## 9. Conectar con nginx (el que atiende a internet)

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/street-burger
nano /etc/nginx/sites-available/street-burger      # cambiá TODOS los "tudominio.com" por tu dominio real
ln -s /etc/nginx/sites-available/street-burger /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 10. Activar HTTPS (candadito)

Esperá a que el dominio ya apunte a tu VPS (paso 1) y ejecutá:

```bash
certbot --nginx -d tudominio.com -d www.tudominio.com
```

Aceptá las preguntas y elegí redirigir HTTP a HTTPS. Se renueva solo.

## 11. Probar

1. Abrí `https://tudominio.com` → tiene que verse el menú.
2. Abrí `https://tudominio.com/admin` → entrá con tu `ADMIN_PASSWORD` → te pide **abrir la caja**.
3. Hacé un pedido de prueba desde el celular y mirá que llegue al panel con sonido.
4. En el panel → **Ajustes** cargá: cantidad de mesas, datos de transferencia, costo de envío y dirección del local.
   Después, en la misma pantalla, imprimí los **QR de las mesas** (ahora sí salen con tu dominio real).

---

## Actualizar cuando haya cambios

```bash
cd /var/www/street-burger
git pull origin deploy
npm ci --omit=dev
pm2 restart street-burger
```

La base se actualiza sola al arrancar (agrega columnas nuevas sin borrar nada).

**Reemplazar el menú de la base por la carta real** (se hace una sola vez, porque borra el menú actual):

```bash
cd /var/www/street-burger
npm run db:menu -- --si-estoy-seguro                       # solo cambia el menú
npm run db:menu -- --limpiar-pedidos --si-estoy-seguro     # además borra pedidos, ventas y cajas de prueba
```

> `--limpiar-pedidos` borra **todos** los pedidos y ventas. Usalo únicamente antes de empezar a trabajar de verdad.

## Copias de seguridad

Manual (guarda la base y las fotos en `~/backups-street-burger`):

```bash
cd /var/www/street-burger && bash deploy/backup.sh
```

Automático todos los días a las 4:30 (`crontab -e` y agregá la línea):

```
30 4 * * * cd /var/www/street-burger && bash deploy/backup.sh >> /var/log/street-burger-backup.log 2>&1
```

> Ojo: las copias quedan **en el mismo servidor**. De vez en cuando bajalas a tu computadora (con FileZilla/WinSCP o `scp`),
> o activá los backups/snapshots del VPS desde el panel de DonWeb.

Restaurar una copia de la base:

```bash
gunzip -c ~/backups-street-burger/db_FECHA.sql.gz | mysql -u street_burger -p street_burger_db
```

## Problemas comunes

| Síntoma | Qué mirar |
|---------|-----------|
| **502 Bad Gateway** | El sitio no está corriendo: `pm2 logs street-burger` (suele ser un dato mal puesto en `.env`) y `pm2 restart street-burger`. |
| **No me deja entrar a /admin** (vuelve al login sin error) | Entrá por **https://**. Con `COOKIE_SECURE=true` el navegador no guarda la sesión por http. Si todavía no tenés HTTPS, ponelo en `false` **temporalmente**. |
| "Demasiados intentos" | 8 contraseñas incorrectas seguidas bloquean 15 minutos. Esperá o `pm2 restart street-burger`. |
| "No se pudo conectar con la base de datos" | Revisá `DB_USER`, `DB_PASSWORD`, `DB_NAME` en `.env` y que MariaDB esté prendida: `systemctl status mariadb`. |
| No se suben las fotos | `chown -R root:root /var/www/street-burger/public/uploads` y que `client_max_body_size 8m;` esté en nginx. |
| No suena el panel | Los navegadores piden un toque en la página para activar el sonido: tocá el cartel amarillo de arriba. |
| La impresión pregunta cada vez | Abrí Chrome con `--kiosk-printing` y dejá la impresora térmica como predeterminada. |

Ver el estado y los logs en cualquier momento: `pm2 status` · `pm2 logs street-burger`.

## Seguridad: lista rápida

- [x] El servidor no arranca con claves de ejemplo ni sin `SESSION_SECRET`.
- [x] Solo están abiertos SSH, 80 y 443 (firewall).
- [x] La base solo escucha en el propio servidor (`127.0.0.1`).
- [x] Sesiones del panel guardadas en la base, cookie `HttpOnly` + `Secure` + `SameSite=Strict`.
- [ ] **Tu parte:** contraseña de `/admin` larga y secreta; contraseña de `root` del VPS fuerte; hacer las copias de seguridad.
- [ ] Recomendado: entrar al VPS con clave SSH en vez de contraseña, y mantener el sistema al día (`apt update && apt upgrade`).
