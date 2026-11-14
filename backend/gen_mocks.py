"""Genera fixtures JSON del contrato §5 (mocks/mask.json, mocks/site.json).

Datos SINTÉTICOS pero físicamente plausibles para el polo sur lunar, solo para
que el frontend arranque sin backend real. NO son datos reales. En H1 los
endpoints devuelven esto mismo pero calculado de verdad.

Correr: python backend/gen_mocks.py
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from constants import (COMMS_MARGIN_DEFAULT_DEG, INTEGRATION_STEP_MIN,
                       MASK_SAMPLES, SOLAR_CONSTANT_W_M2, WINDOW_DAYS_DEFAULT)

MOCKS = Path(__file__).resolve().parent / "mocks"
SITE = {"lat": -89.9, "lon": 0.0, "name": "Shackleton (borde)"}


def make_mask() -> dict:
    """h(az): base baja + una cresta de cráter, 360 muestras (SPEC §3.3)."""
    mask = []
    for i in range(MASK_SAMPLES):
        az = i * 360.0 / MASK_SAMPLES
        # base ~1.5° + cresta gaussiana centrada en 120°, hueco bajo al sur
        rim = 6.0 * math.exp(-((az - 120.0) ** 2) / (2 * 25.0 ** 2))
        h = 1.5 + rim + 0.5 * math.sin(math.radians(az * 2))
        mask.append({"az": round(az, 2), "h_deg": round(max(0.0, h), 3)})
    return {"site": SITE, "horizon_mask": mask}


def _mask_at(mask: list[dict], az: float) -> float:
    idx = int(round(az / (360.0 / len(mask)))) % len(mask)
    return mask[idx]["h_deg"]


def make_site(mask: list[dict]) -> dict:
    """Tracks Sol/Tierra + métricas sobre la ventana (SPEC §3.1, §3.2, §5)."""
    step = timedelta(minutes=INTEGRATION_STEP_MIN)
    n = int(WINDOW_DAYS_DEFAULT * 24 * 60 / INTEGRATION_STEP_MIN)
    t0 = datetime(2026, 11, 14, tzinfo=timezone.utc)

    sun_track, earth_track = [], []
    energy_h = energy_v = 0.0
    lit = earth_vis = 0
    for k in range(n):
        t = t0 + k * step
        frac = k / n
        # Sol: elevación oscila 0..~3° en ciclo sinódico; azimut gira lento
        sun_el = 1.5 + 1.5 * math.sin(2 * math.pi * frac - 1.2)
        sun_az = (k * 0.25) % 360.0
        sun_vis = sun_el > _mask_at(mask, sun_az)
        # Tierra: pegada al horizonte, oscila ±6.7° por libración (SPEC §3.2)
        earth_el = 6.7 * math.sin(2 * math.pi * frac * 1.07)
        earth_az = 10.0 + 7.0 * math.sin(2 * math.pi * frac * 1.07)
        earth_vis_now = earth_el > _mask_at(mask, earth_az) + COMMS_MARGIN_DEFAULT_DEG

        sun_track.append({"t": t.isoformat(), "az": round(sun_az, 2),
                          "el": round(sun_el, 3), "visible": sun_vis})
        earth_track.append({"t": t.isoformat(), "az": round(earth_az, 2),
                            "el": round(earth_el, 3), "visible": earth_vis_now})

        dt_h = INTEGRATION_STEP_MIN / 60.0
        if sun_vis and sun_el > 0:
            s = math.sin(math.radians(sun_el))
            energy_h += SOLAR_CONSTANT_W_M2 * s * dt_h          # panel horizontal
            energy_v += SOLAR_CONSTANT_W_M2 * 1.0 * dt_h        # vertical sun-tracking
            lit += 1
        if earth_vis_now:
            earth_vis += 1

    return {
        "site": SITE,
        "sun_track": sun_track,
        "earth_track": earth_track,
        "metrics": {
            "energy_kwh_m2": {
                "horizontal": round(energy_h / 1000.0, 3),
                "vertical_sun_tracking": round(energy_v / 1000.0, 3),
            },
            "lit_fraction": round(lit / n, 3),
            "longest_night_h": 92.0,
            "earth_vis_fraction": round(earth_vis / n, 3),
            "longest_comms_gap_h": 61.0,
            "next_sunset_h": 18.5,
            "next_earthset_h": 7.2,
        },
        "params": {"comms_margin_deg": COMMS_MARGIN_DEFAULT_DEG,
                   "window_days": WINDOW_DAYS_DEFAULT},
    }


def main() -> None:
    MOCKS.mkdir(parents=True, exist_ok=True)
    mask = make_mask()
    (MOCKS / "mask.json").write_text(json.dumps(mask, indent=1))
    site = make_site(mask["horizon_mask"])
    (MOCKS / "site.json").write_text(json.dumps(site, indent=1))
    print(f"mask.json: {len(mask['horizon_mask'])} muestras")
    print(f"site.json: {len(site['sun_track'])} puntos/track, "
          f"energía_h={site['metrics']['energy_kwh_m2']['horizontal']} kWh/m²")


if __name__ == "__main__":
    main()
