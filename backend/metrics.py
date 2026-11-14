"""Energía integrada y métricas por sitio (SPEC §3.1, §3.2, §5).

Energía = integral, NO % de tiempo iluminado:
    E_total = Σ S·factor(e)·V·Δt           [Wh/m²]  → /1000 = kWh/m²
  - panel horizontal:        factor = max(0, sin e)
  - panel vertical sun-track: factor = max(0, cos e)   (normal horizontal al Sol;
    capta el Sol rasante del polo mucho mejor que el horizontal)
  - V = 1 si el astro está visible sobre la máscara, 0 si no (sin penumbra en MVP).

Las métricas integradas solo son representativas si window_days ≥ ~29.5 (§5).
"""

from __future__ import annotations

import math

from constants import SOLAR_CONSTANT_W_M2


def integrate_energy(sun_track: list[dict], step_min: int) -> dict:
    """kWh/m² sobre la ventana para panel horizontal y vertical sun-tracking."""
    dt_h = step_min / 60.0
    wh_h = wh_v = 0.0
    for p in sun_track:
        if not p["visible"]:
            continue
        e = math.radians(p["el"])
        wh_h += SOLAR_CONSTANT_W_M2 * max(0.0, math.sin(e)) * dt_h
        wh_v += SOLAR_CONSTANT_W_M2 * max(0.0, math.cos(e)) * dt_h
    return {"horizontal": round(wh_h / 1000.0, 4),
            "vertical_sun_tracking": round(wh_v / 1000.0, 4)}


def visible_fraction(track: list[dict]) -> float:
    return round(sum(p["visible"] for p in track) / len(track), 4) if track else 0.0


def longest_gap_h(track: list[dict], step_min: int) -> float:
    """Mayor corte continuo con el astro NO visible, en horas (§3.1/§3.2)."""
    dt_h = step_min / 60.0
    best = run = 0
    for p in track:
        run = run + 1 if not p["visible"] else 0
        best = max(best, run)
    return round(best * dt_h, 2)


def next_set_h(track: list[dict], step_min: int) -> float | None:
    """Horas desde el inicio hasta el próximo ocaso (visible → no visible)."""
    dt_h = step_min / 60.0
    for i in range(len(track) - 1):
        if track[i]["visible"] and not track[i + 1]["visible"]:
            return round((i + 1) * dt_h, 2)
    return None


def compute_metrics(sun_track: list[dict], earth_track: list[dict], step_min: int) -> dict:
    """Bloque `metrics` del contrato §5."""
    return {
        "energy_kwh_m2": integrate_energy(sun_track, step_min),
        "lit_fraction": visible_fraction(sun_track),
        "longest_night_h": longest_gap_h(sun_track, step_min),
        "earth_vis_fraction": visible_fraction(earth_track),
        "longest_comms_gap_h": longest_gap_h(earth_track, step_min),
        "next_sunset_h": next_set_h(sun_track, step_min),
        "next_earthset_h": next_set_h(earth_track, step_min),
    }
