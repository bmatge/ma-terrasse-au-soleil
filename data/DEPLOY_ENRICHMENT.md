# Déploiement enrichissement OSM + SIRENE

## Pré-requis
SSH sur le VPS, dans le dossier du projet.

## Étape 1 : Backup de la DB

```bash
# Créer le dump (compressé, ~quelques Mo)
docker compose exec db pg_dump -U terrasse -Fc terrasse_soleil > backup_terrasses_$(date +%Y%m%d_%H%M).dump

# Vérifier que le fichier est bien créé
ls -lh backup_terrasses_*.dump
```

Pour restaurer si besoin :
```bash
docker compose exec -T db pg_restore -U terrasse -d terrasse_soleil --clean < backup_terrasses_XXXXXXXX_XXXX.dump
```

## Étape 2 : Passer sur la branche et rebuild

```bash
git fetch origin
git checkout feature/enrichment-osm-sirene
git pull

# Rebuild le backend (ajoute rapidfuzz dans l'image)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend
```

## Étape 3 : Appliquer la migration 005

```bash
# Migration non destructive : ne fait qu'ajouter 9 colonnes + 2 index
docker compose exec backend alembic upgrade head
```

Vérifier :
```bash
docker compose exec db psql -U terrasse -d terrasse_soleil -c "\d terrasses" | grep -E "osm_id|enseigne_sirene|opening_hours"
```

## Étape 4 : Test limité (10 terrasses)

```bash
# Enrichissement OSM + SIRENE sur 10 terrasses seulement
docker compose exec backend python -m data.enrich_osm_sirene --limit 10 --skip-osm-import

# Vérifier les résultats
docker compose exec db psql -U terrasse -d terrasse_soleil -c "
SELECT nom, nom_commercial, enseigne_sirene, osm_id, opening_hours, cuisine, outdoor_seating, enrichment_source
FROM terrasses
WHERE osm_id IS NOT NULL OR enseigne_sirene IS NOT NULL
LIMIT 20;
"
```

## Étape 5 : Run complet si OK

```bash
# Enrichissement complet (toutes les terrasses)
docker compose exec backend python -m data.enrich_osm_sirene

# Vérifier les stats
docker compose exec db psql -U terrasse -d terrasse_soleil -c "
SELECT
  COUNT(*) as total,
  COUNT(osm_id) as matched_osm,
  COUNT(enseigne_sirene) as enrichi_sirene,
  COUNT(nom_commercial) as avec_nom_commercial,
  COUNT(opening_hours) as avec_horaires,
  COUNT(outdoor_seating) FILTER (WHERE outdoor_seating = true) as outdoor_confirmed,
  COUNT(*) FILTER (WHERE source = 'osm') as bars_importes_osm
FROM terrasses;
"
```

## Étape 6 : Merger si satisfait

```bash
git checkout main
git merge feature/enrichment-osm-sirene
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend
```

## Mise à jour périodique (après merge)

```bash
# Pipeline complet : download + sync + enrichissement + horizons
docker compose exec backend python -m data.update_pipeline

# Version rapide (sans recalcul horizons)
docker compose exec backend python -m data.update_pipeline --skip-horizons
```

À lancer en cron mensuel par exemple :
```bash
# crontab -e
0 3 1 * * cd /path/to/ma-terrasse-au-soleil && docker compose exec -T backend python -m data.update_pipeline >> /var/log/terrasse-update.log 2>&1
```
