#!/bin/bash
set -euo pipefail

# Terrasse au Soleil — deployment script for OVH VPS
# Usage:
#   ./deploy.sh          → full deploy (pull + build + migrate + start)
#   ./deploy.sh init     → first deploy (pull + build + migrate + download data + import + compute + start)
#   ./deploy.sh update   → quick update (pull + build + migrate + restart)
#   ./deploy.sh stop     → stop all services
#   ./deploy.sh logs     → follow logs
#   ./deploy.sh status   → show service status

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
BACKEND_EXEC="$COMPOSE exec -T backend"

cd "$(dirname "$0")"

log() { echo -e "\n\033[1;33m▸ $1\033[0m"; }

case "${1:-deploy}" in

  init)
    log "First-time deployment"

    log "Pulling latest code..."
    git pull --ff-only

    log "Building images..."
    $COMPOSE build

    log "Starting services..."
    $COMPOSE up -d

    log "Waiting for database..."
    sleep 5

    log "Running migrations..."
    $BACKEND_EXEC alembic upgrade head

    log "Downloading data (BD TOPO + terrasses)..."
    cd data && bash download_bdtopo.sh && bash download_terrasses.sh && cd ..

    log "Importing buildings..."
    $BACKEND_EXEC python /app/data/import_batiments.py

    log "Importing terrasses..."
    $BACKEND_EXEC python /app/data/import_terrasses.py

    log "Computing horizon profiles (this may take several minutes)..."
    $BACKEND_EXEC python /app/data/compute_horizon_profiles.py

    log "Validating data..."
    $BACKEND_EXEC python /app/data/validate_data.py

    log "Done! Site live at https://terrasses.paris.matge.com"
    ;;

  deploy|update)
    log "Updating deployment..."

    log "Pulling latest code..."
    git pull --ff-only

    log "Building images..."
    $COMPOSE build

    log "Stopping services..."
    $COMPOSE down

    log "Starting services..."
    $COMPOSE up -d

    log "Waiting for database..."
    sleep 5

    log "Running migrations..."
    $BACKEND_EXEC alembic upgrade head

    log "Done! Site live at https://terrasses.paris.matge.com"
    ;;

  stop)
    log "Stopping services..."
    $COMPOSE down
    ;;

  logs)
    $COMPOSE logs -f
    ;;

  status)
    $COMPOSE ps
    ;;

  *)
    echo "Usage: ./deploy.sh [init|deploy|update|stop|logs|status]"
    exit 1
    ;;

esac
