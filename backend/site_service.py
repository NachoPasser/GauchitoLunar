"""Servicio de /api/site: tracks + métricas por sitio y fecha (SPEC §5).

Depende de la fecha (a diferencia de la máscara). Ensambla exactamente la forma
del contrato §5: site, sun_track, earth_track, metrics, params.
"""

from __future__ import annotations

from datetime import datetime, timezone

from constants import (COMMS_MARGIN_DEFAULT_DEG, INTEGRATION_STEP_MIN,
                       WINDOW_DAYS_DEFAULT)
from ephem import ensure_cache
from intervals import earth_intervals, sun_intervals
from mask_service import get_mask
from metrics import compute_metrics
from tracks import build_tracks

# Default alineado al inicio del cache de Horizons (ver fetch_horizons.py).
DEFAULT_START = datetime(2026, 11, 14, tzinfo=timezone.utc)


def _parse_start(date: str | None) -> datetime:
    if not date:
        return DEFAULT_START
    return datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def get_site(
    lat: float,
    lon: float,
    date: str | None = None,
    window_days: int = WINDOW_DAYS_DEFAULT,
    comms_margin_deg: float = COMMS_MARGIN_DEFAULT_DEG,
    step_min: int = INTEGRATION_STEP_MIN,
) -> dict:
    mask = get_mask(lat, lon)                     # usa cache por sitio
    h = [p["h_deg"] for p in mask["horizon_mask"]]
    start = _parse_start(date)

    # Sitio libre sin cache de Horizons → fetch en vivo on-miss (+2 d de colchón
    # para no quedar corto al final de la ventana). Lanza EphemerisError si no hay red.
    ensure_cache(lat, lon, start, days=window_days + 2)

    sun_track, earth_track = build_tracks(
        {"lat": lat, "lon": lon}, h, start, window_days, comms_margin_deg, step_min)

    return {
        "site": mask["site"],
        "sun_track": sun_track,
        "earth_track": earth_track,
        "sun_intervals": sun_intervals(sun_track),       # cartuchos lit/dark (§3.1)
        "earth_intervals": earth_intervals(earth_track),  # cartuchos visible/hidden
        "metrics": compute_metrics(sun_track, earth_track, step_min),
        "params": {"comms_margin_deg": comms_margin_deg, "window_days": window_days},
    }
