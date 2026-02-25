#!/bin/bash
set -euo pipefail

RAW_DIR="$(dirname "$0")/raw"
mkdir -p "$RAW_DIR"
cd "$RAW_DIR"

FILENAME="terrasses_paris.geojson"

echo "Downloading terrasses Paris Open Data..."
curl -L -o "$FILENAME" \
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/terrasses-autorisations/exports/geojson?limit=-1"

COUNT=$(python3 -c "import json; d=json.load(open('$FILENAME')); print(len(d['features']))")
echo "Done. $COUNT terrasses downloaded."
