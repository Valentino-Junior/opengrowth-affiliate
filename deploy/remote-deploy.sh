#!/usr/bin/env bash
# Runs on the VPS (called by the Deploy workflow): switch the app and worker to IMAGE, then wait until healthy.
#   bash /opt/opengrowth/deploy/remote-deploy.sh ghcr.io/OWNER/opengrowth-affiliate:SHA
set -euo pipefail
IMAGE="$1"
cd /opt/opengrowth

# Remember the image in .env, so a plain `docker compose up -d` later keeps the same version.
sed -i '/^APP_IMAGE=/d' .env
echo "APP_IMAGE=$IMAGE" >> .env

docker compose pull app
docker compose up -d --remove-orphans   # the app runs database migrations as it starts

for i in $(seq 1 40); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)")
  if [ "$status" = "healthy" ]; then
    echo "$(date -Is) deployed $IMAGE"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 3
done
echo "The app didn't become healthy. Last logs:" >&2
docker compose logs --tail 80 app >&2
exit 1
