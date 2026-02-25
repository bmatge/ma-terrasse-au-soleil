.PHONY: dev prod stop logs import compute download clean

# Development
dev:
	docker compose up --build

dev-detach:
	docker compose up --build -d

# Production (VPS OVH)
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

import:
	docker compose exec backend python -m data.import_batiments
	docker compose exec backend python -m data.import_terrasses

compute:
	docker compose exec backend python -m data.compute_horizon_profiles

# Database shell
db-shell:
	docker compose exec db psql -U terrasse -d terrasse_soleil

# Clean everything (volumes included)
clean:
	docker compose down -v
