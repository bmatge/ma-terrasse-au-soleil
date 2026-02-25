#!/bin/bash
set -euo pipefail

RAW_DIR="$(dirname "$0")/raw"
mkdir -p "$RAW_DIR"
cd "$RAW_DIR"

URL="https://data.geopf.fr/telechargement/download/BDTOPO/BDTOPO_3-5_TOUSTHEMES_GPKG_LAMB93_D075_2025-12-15/BDTOPO_3-5_TOUSTHEMES_GPKG_LAMB93_D075_2025-12-15.7z"
FILENAME="bdtopo_d075.7z"

if [ -f "$FILENAME" ]; then
    echo "BD TOPO already downloaded: $FILENAME"
else
    echo "Downloading BD TOPO D075 (~200 MB)..."
    curl -L -o "$FILENAME" "$URL"
fi

if [ ! -d "bdtopo_d075" ]; then
    echo "Extracting..."
    7z x "$FILENAME" -obdtopo_d075
fi

echo "Done. GeoPackage files:"
find ./bdtopo_d075 -name "*.gpkg" -print
