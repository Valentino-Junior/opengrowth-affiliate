#!/usr/bin/env bash
# Nightly database backup. Keeps 30 days. Add to the VPS crontab (crontab -e):
#   15 3 * * * /opt/opengrowth/deploy/backup.sh >> /var/log/opengrowth-backup.log 2>&1
# Optional off-server copy: set BACKUP_S3_URI (e.g. s3://my-backups/opengrowth) and install the AWS CLI.
set -euo pipefail

cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-/var/backups/opengrowth}"
mkdir -p "$DIR"
FILE="$DIR/opengrowth-$(date +%Y-%m-%d-%H%M).sql.gz"

docker compose exec -T db pg_dump -U opengrowth -d opengrowth --no-owner | gzip > "$FILE"
echo "$(date -Is) wrote $FILE ($(du -h "$FILE" | cut -f1))"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$FILE" "$BACKUP_S3_URI/$(basename "$FILE")" --only-show-errors
  echo "$(date -Is) copied to $BACKUP_S3_URI"
fi

find "$DIR" -name 'opengrowth-*.sql.gz' -mtime +30 -delete
