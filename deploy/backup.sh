#!/usr/bin/env bash
# Copia de seguridad: base de datos + fotos subidas. Guarda las últimas 14 copias.
# Uso manual:   bash deploy/backup.sh
# Automático (todos los días a las 4:30):   crontab -e  y agregar
#   30 4 * * * cd /var/www/street-burger && bash deploy/backup.sh >> /var/log/street-burger-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

DESTINO="${BACKUP_DIR:-$HOME/backups-street-burger}"
FECHA="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DESTINO"

mysqldump -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" ${DB_PASSWORD:+-p"$DB_PASSWORD"} \
  --single-transaction --routines "$DB_NAME" | gzip > "$DESTINO/db_$FECHA.sql.gz"
tar -czf "$DESTINO/fotos_$FECHA.tar.gz" -C public uploads

# borrar copias de más de 14 días
find "$DESTINO" -name 'db_*.sql.gz' -mtime +14 -delete
find "$DESTINO" -name 'fotos_*.tar.gz' -mtime +14 -delete
echo "✅ Backup listo en $DESTINO ($FECHA)"
