#!/usr/bin/env bash
# Nightly backup: the database (a dated copy, kept 30 days) and the uploaded files (payment screenshots, ID photos).
# Add to the VPS crontab as root (crontab -e):
#   15 3 * * * /opt/opengrowth/deploy/backup.sh >> /var/log/opengrowth-backup.log 2>&1
# Off-server copy (recommended: a disk failure takes local backups with it): set BACKUP_S3_URI
# (e.g. s3://my-backups/opengrowth) and install the AWS CLI.
set -euo pipefail

cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-/var/backups/opengrowth}"
mkdir -p "$DIR"
FILE="$DIR/opengrowth-$(date +%Y-%m-%d-%H%M).sql.gz"

docker compose exec -T db pg_dump -U opengrowth -d opengrowth --no-owner | gzip > "$FILE"
echo "$(date -Is) wrote $FILE ($(du -h "$FILE" | cut -f1))"

# Uploads live on the VPS unless S3_BUCKET is set (then S3 keeps them). Uploaded files never change, so one
# mirror copy is enough; it's refreshed every night.
if ! grep -qE '^S3_BUCKET=.+' .env; then
  mkdir -p "$DIR/uploads"
  docker compose cp app:/app/storage/. "$DIR/uploads/" >/dev/null
  echo "$(date -Is) uploads copied to $DIR/uploads ($(du -sh "$DIR/uploads" | cut -f1))"
fi

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$FILE" "$BACKUP_S3_URI/$(basename "$FILE")" --only-show-errors
  [ -d "$DIR/uploads" ] && aws s3 sync "$DIR/uploads" "$BACKUP_S3_URI/uploads" --only-show-errors
  echo "$(date -Is) copied to $BACKUP_S3_URI"
fi

find "$DIR" -maxdepth 1 -name 'opengrowth-*.sql.gz' -mtime +30 -delete
