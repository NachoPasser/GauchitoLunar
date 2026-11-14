"""Efemérides de Sol y Tierra encapsuladas (SPEC §4.3).

Única puerta de entrada a las efemérides para el resto del código. Hoy lee del
cache en disco generado por fetch_horizons.py; mañana podría pegarle a Horizons
en vivo sin que cambie la firma. NO atar el resto del código a Horizons.

Convención de salida: az/el en grados, marco ENU local del sitio (SPEC §3.0).
"""

from __future__ import annotations

import bisect
import json
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = DATA_DIR / "horizons"

# cache en memoria: {(round(lat,4), round(lon,4), target): [(epoch_s, az, el), ...]}
_CACHE: dict[tuple, list[tuple[float, float, float]]] = {}


def _cache_path(lat: float, lon: float, target: str) -> Path:
    """Ruta del JSON cacheado para un sitio y target ('sun' | 'earth')."""
    return CACHE_DIR / f"{lat:+.4f}_{lon:+.4f}_{target}.json"


def _load(lat: float, lon: float, target: str) -> list[tuple[float, float, float]]:
    """Carga (y memoiza) el track cacheado como lista ordenada por tiempo."""
    key = (round(lat, 4), round(lon, 4), target)
    if key in _CACHE:
        return _CACHE[key]
    path = _cache_path(lat, lon, target)
    if not path.exists():
        raise FileNotFoundError(
            f"Sin cache de Horizons para {target} en ({lat}, {lon}): {path}. "
            "Corré backend/fetch_horizons.py primero."
        )
    raw = json.loads(path.read_text())
    track = [
        (datetime.fromisoformat(p["t"]).timestamp(), float(p["az"]), float(p["el"]))
        for p in raw["points"]
    ]
    track.sort(key=lambda r: r[0])
    _CACHE[key] = track
    return track


def _interp(track: list[tuple[float, float, float]], epoch: float) -> tuple[float, float]:
    """Interpolación lineal de (az, el) al instante epoch (segundos UTC)."""
    times = [r[0] for r in track]
    i = bisect.bisect_left(times, epoch)
    if i <= 0:
        return track[0][1], track[0][2]
    if i >= len(track):
        return track[-1][1], track[-1][2]
    t0, az0, el0 = track[i - 1]
    t1, az1, el1 = track[i]
    f = (epoch - t0) / (t1 - t0) if t1 != t0 else 0.0
    # az: interpolar por el camino corto para no romper en el wrap 360→0
    daz = ((az1 - az0 + 180.0) % 360.0) - 180.0
    az = (az0 + f * daz) % 360.0
    el = el0 + f * (el1 - el0)
    return az, el


def ephem(site: dict, t: datetime, target: str = "sun") -> tuple[float, float]:
    """(az, el) en grados del `target` ('sun' | 'earth') visto desde `site`, en `t` (UTC).

    `site` es un dict con al menos {'lat', 'lon'}. Lee del cache en disco.
    """
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    track = _load(site["lat"], site["lon"], target)
    return _interp(track, t.timestamp())
