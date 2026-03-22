.PHONY: dev prod stop logs download migrate import validate compute sun-stats db-shell clean

# Development
dev:
	docker compose up --build

dev-detach:
	docker compose up --build -d

# Production (VPS OVH — Traefik on ecosysteme-network)
prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Stop all services
stop:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Data pipeline
download:
	cd data && bash download_bdtopo.sh
	cd data && bash download_terrasses.sh

migrate:
	docker compose exec backend alembic upgrade head

import: migrate
	docker compose exec backend python /app/data/import_batiments.py
	docker compose exec backend python /app/data/import_terrasses.py

validate:
	docker compose exec backend python /app/data/validate_data.py

compute:
	docker compose exec backend python /app/data/compute_horizon_profiles.py

# Sun stats for blog posts (pass DATES, e.g. make sun-stats DATES="2026-04-05 2026-04-06")
sun-stats:
	docker compose exec backend python /app/data/compute_sun_stats.py $(DATES)

sun-stats-csv:
	docker compose exec backend python /app/data/compute_sun_stats.py --export-csv $(DATES)

sun-stats-clear:
	docker compose exec backend python /app/data/compute_sun_stats.py --clear $(DATES)

# Enrichment (OSM + SIRENE, free APIs)
enrich:
	docker compose exec backend python -m data.enrich_osm_sirene

# Full update pipeline (download + sync + enrich + horizons)
update:
	docker compose exec backend python -m data.update_pipeline

# Database backup
db-backup:
	docker compose exec db pg_dump -U terrasse -Fc terrasse_soleil > backup_terrasses_$$(date +%Y%m%d_%H%M).dump
	@ls -lh backup_terrasses_*.dump | tail -1

# Database shell
db-shell:
	docker compose exec db psql -U terrasse -d terrasse_soleil

# Clean everything (volumes included)
clean:
	docker compose down -v
