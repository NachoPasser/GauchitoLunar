#!/usr/bin/env bash
# Baja DEM polar + rasters de iluminación a data/ (SPEC §4.1, §4.2).
# Self-host: no dependemos de la red del venue. ~181 MB (DEM) + rasters 60 m.
# No van al repo (ver .gitignore).
set -euo pipefail

DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

PGDA="https://pgda.gsfc.nasa.gov/data"

echo "Descargando a $DATA_DIR ..."

# DEM polar 80 m/px (80–90°S, 181 MB) — caballito de batalla para la máscara
curl -fSL -O "$PGDA/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF"

# Fondo del mapa: iluminación solar 85°S–90°S, 60 m/px
curl -fSL -O "$PGDA/MoonIllumination/AVGVISIB_85S_060M_201608.TIF"

# Capa comms: visibilidad de la Tierra
curl -fSL -O "$PGDA/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF"

# Overlay: sombra permanente (PSR)
curl -fSL -O "$PGDA/MoonIllumination/LPSR_85S_060M_201608.TIF"

echo "Listo:"
ls -lh "$DATA_DIR"
