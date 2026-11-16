"""Servicio de máscara por sitio: computa h(az) sobre el DEM y cachea (SPEC §3.3, §5).

La máscara NO depende de la fecha → se calcula una vez por sitio y se guarda en
disco (data/mask_cache/) y en memoria. Devuelve la forma del contrato §5.
"""

from __future__ import annotations

import json
from pathlib import Path

import geo
from mask import compute_mask, mask_to_contract
from sites import find_seed_site

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "mask_cache"
# Subir al cambiar el algoritmo de la máscara: invalida el cache en disco viejo.
# v1 = alcance fijo 50 km (sin prefijo); v2 = alcance adaptativo √(2R·Δz).
CACHE_VERSION = "v2"
_MEM: dict[tuple, dict] = {}


def _site_name(lat: float, lon: float) -> str:
    s = find_seed_site(lat, lon)
    return s["name"] if s else f"{lat:.3f}, {lon:.3f}"


def _cache_path(lat: float, lon: float) -> Path:
    return CACHE_DIR / f"{CACHE_VERSION}_{lat:+.4f}_{lon:+.4f}.json"


def get_mask(lat: float, lon: float, max_km: float | None = None) -> dict:
    """Contrato §5 de /api/mask. Usa cache en memoria → disco → cómputo."""
    key = (round(lat, 4), round(lon, 4))
    if key in _MEM:
        return _MEM[key]

    path = _cache_path(lat, lon)
    if path.exists():
        data = json.loads(path.read_text())
        _MEM[key] = data
        return data

    r, c = geo.lonlat_to_rowcol(lon, lat)
    north, east = geo.local_dirs_px(lon, lat)
    h = compute_mask(geo.dem_array(), r, c, north, east, geo.mpp(), max_km=max_km)
    data = {
        "site": {"lat": lat, "lon": lon, "name": _site_name(lat, lon)},
        "horizon_mask": mask_to_contract(h),
    }
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))
    _MEM[key] = data
    return data


def get_mask_array(lat: float, lon: float):
    """h(az) como lista de floats (para tracks/métricas), en el orden del contrato."""
    return [p["h_deg"] for p in get_mask(lat, lon)["horizon_mask"]]
