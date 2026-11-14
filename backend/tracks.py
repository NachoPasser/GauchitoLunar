"""Tracks de Sol/Tierra + visibilidad contra la máscara (SPEC §3.2, §5).

visible(Sol)   = el_Sol   > h(az_Sol)
visible(Tierra)= el_Tierra > h(az_Tierra) + margen_comms

Azimut 0=N horario: el índice de la máscara y el az de Horizons comparten cero y
sentido (garantizado por geo.local_dirs_px). Mismo reloj UTC en todo.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from constants import COMMS_MARGIN_DEFAULT_DEG, INTEGRATION_STEP_MIN
from ephem import ephem


def h_at(h_mask: list[float], az_deg: float) -> float:
    """Elevación del horizonte en ese azimut (muestra más cercana de la máscara)."""
    n = len(h_mask)
    idx = int(round((az_deg % 360.0) / (360.0 / n))) % n
    return h_mask[idx]


def is_visible(el_deg: float, az_deg: float, h_mask: list[float], margin_deg: float) -> bool:
    """¿El astro está sobre el terreno en ese azimut (con margen)?"""
    return el_deg > h_at(h_mask, az_deg) + margin_deg


def build_tracks(
    site: dict,
    h_mask: list[float],
    start: datetime,
    window_days: int,
    margin_deg: float = COMMS_MARGIN_DEFAULT_DEG,
    step_min: int = INTEGRATION_STEP_MIN,
) -> tuple[list[dict], list[dict]]:
    """(sun_track, earth_track) en la forma del contrato §5 sobre la ventana."""
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    step = timedelta(minutes=step_min)
    n = int(window_days * 24 * 60 / step_min)

    sun_track, earth_track = [], []
    for k in range(n + 1):
        t = start + k * step
        saz, sel = ephem(site, t, "sun")
        eaz, eel = ephem(site, t, "earth")
        iso = t.isoformat()
        sun_track.append({
            "t": iso, "az": round(saz, 3), "el": round(sel, 3),
            "visible": is_visible(sel, saz, h_mask, 0.0),
        })
        earth_track.append({
            "t": iso, "az": round(eaz, 3), "el": round(eel, 3),
            "visible": is_visible(eel, eaz, h_mask, margin_deg),
        })
    return sun_track, earth_track
