.PHONY: dev prod stop logs download migrate import validate compute db-shell clean

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

# Database shell
db-shell:
	docker compose exec db psql -U terrasse -d terrasse_soleil

# Clean everything (volumes included)
clean:
	docker compose down -v
