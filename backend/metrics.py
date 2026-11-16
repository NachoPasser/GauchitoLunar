"""Energía integrada y métricas por sitio (SPEC §3.1, §3.2, §5).

Energía = integral, NO % de tiempo iluminado:
    E_total = ∫ S·factor(e)·V dt  (trapecio)   [Wh/m²]  → /1000 = kWh/m²
  - panel horizontal:        factor = max(0, sin e)
  - panel vertical sun-track: factor = max(0, cos e)   (normal horizontal al Sol;
    capta el Sol rasante del polo mucho mejor que el horizontal)
  - V = 1 si el astro está visible sobre la máscara, 0 si no (sin penumbra en MVP).

Las métricas integradas solo son representativas si window_days ≥ ~29.5 (§5).
"""

from __future__ import annotations

import math
from datetime import datetime

from constants import SOLAR_CONSTANT_W_M2, SUN_ANGULAR_RADIUS_DEG
from intervals import earth_intervals, longest_state_h, sun_intervals
from solar import solar_disc_fraction, solar_distance_au, solar_irradiance
from tracks import h_at


def _trapz(vals: list[float], dt_h: float) -> float:
    """Regla del trapecio con paso uniforme: n muestras abarcan (n−1) intervalos."""
    if len(vals) < 2:
        return 0.0
    return dt_h * (sum(vals) - 0.5 * (vals[0] + vals[-1]))


def _sample_state(p: dict, h_mask: list[float] | None) -> tuple[float, float]:
    """(irradiancia W/m², fracción visible V∈[0,1]) de una muestra del track.

    S = S₁ᵤₐ/r² si la muestra trae `t` (si no, S₁ᵤₐ). Con h_mask, V es la fracción del
    disco solar sobre el horizonte (el Sol no es un punto); sin h_mask, V = flag visible.
    """
    try:
        t = datetime.fromisoformat(p["t"])
        s, rho = solar_irradiance(t), SUN_ANGULAR_RADIUS_DEG / solar_distance_au(t)
    except (KeyError, ValueError):
        s, rho = SOLAR_CONSTANT_W_M2, SUN_ANGULAR_RADIUS_DEG
    if h_mask is None:
        return s, 1.0 if p["visible"] else 0.0
    return s, solar_disc_fraction(p["el"] - h_at(h_mask, p["az"]), rho)


def integrate_energy(sun_track: list[dict], step_min: int,
                     h_mask: list[float] | None = None) -> dict:
    """kWh/m² sobre la ventana para panel horizontal y vertical sun-tracking.

    Trapecio sobre las muestras: la ventana dura (n−1)·Δt, no n·Δt (la suma
    rectangular sumaba un intervalo de más). Irradiancia con 1/r² y, si se pasa h_mask,
    disco solar finito (ver _sample_state). El factor geométrico usa la elevación del centro.
    """
    dt_h = step_min / 60.0
    flux_h, flux_v = [], []
    for p in sun_track:
        e = math.radians(p["el"])
        s, v = _sample_state(p, h_mask)
        flux_h.append(s * max(0.0, math.sin(e)) * v)
        flux_v.append(s * max(0.0, math.cos(e)) * v)
    return {"horizontal": round(_trapz(flux_h, dt_h) / 1000.0, 4),
            "vertical_sun_tracking": round(_trapz(flux_v, dt_h) / 1000.0, 4)}


def visible_fraction(track: list[dict]) -> float:
    return round(sum(p["visible"] for p in track) / len(track), 4) if track else 0.0


def next_set_h(track: list[dict], step_min: int) -> float | None:
    """Horas desde el inicio hasta el próximo ocaso (visible → no visible)."""
    dt_h = step_min / 60.0
    for i in range(len(track) - 1):
        if track[i]["visible"] and not track[i + 1]["visible"]:
            return round((i + 1) * dt_h, 2)
    return None


def compute_metrics(sun_track: list[dict], earth_track: list[dict], step_min: int,
                    sun_ivs: list[dict] | None = None,
                    earth_ivs: list[dict] | None = None,
                    h_mask: list[float] | None = None) -> dict:
    """Bloque `metrics` del contrato §5. Los cortes más largos salen de los intervalos
    (los mismos de los cartuchos); si no se pasan, se derivan de los tracks. h_mask activa
    el disco solar finito en la energía (lit_fraction y cartuchos siguen por el centro)."""
    sun_ivs = sun_intervals(sun_track) if sun_ivs is None else sun_ivs
    earth_ivs = earth_intervals(earth_track) if earth_ivs is None else earth_ivs
    return {
        "energy_kwh_m2": integrate_energy(sun_track, step_min, h_mask),
        "lit_fraction": visible_fraction(sun_track),
        "longest_night_h": longest_state_h(sun_ivs, "dark"),
        "earth_vis_fraction": visible_fraction(earth_track),
        "longest_comms_gap_h": longest_state_h(earth_ivs, "hidden"),
        "next_sunset_h": next_set_h(sun_track, step_min),
        "next_earthset_h": next_set_h(earth_track, step_min),
    }
