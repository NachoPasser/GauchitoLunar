"""Baja az/el de Sol y Tierra desde JPL Horizons y los cachea en disco (SPEC §4.3).

Observador = sitio lunar (topocéntrico sobre el cuerpo 301, marco geodético).
Target = Sol (10) o Tierra (399). Salida: azimut (0=N, horario) y elevación,
marco local, en grados. Se baja UNA vez el rango y se sirve desde cache; el
riesgo a mitigar es que Horizons no responda en el venue → pre-generar.

Uso:
    python backend/fetch_horizons.py                 # todos los sitios semilla, 35 d
    python backend/fetch_horizons.py --days 40 --step 30m
    python backend/fetch_horizons.py --start 2026-11-14

Escribe data/horizons/{lat}_{lon}_{sun|earth}.json
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from sites import SEED_SITES

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "horizons"

TARGETS = {"sun": "10", "earth": "399"}
_FLOAT = re.compile(r"[-+]?\d+\.\d+")


def _query(command: str, lat: float, lon: float, start: str, stop: str, step: str) -> str:
    """Pide a Horizons la tabla OBSERVER de az/el; devuelve el texto crudo."""
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",          # topocéntrico sobre la Luna
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},0'",  # lon este, lat, alt_km
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'4'",               # Azimuth & Elevation
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",
        "CSV_FORMAT": "'NO'",
    }
    r = httpx.get(HORIZONS_URL, params=params, timeout=60.0)
    r.raise_for_status()
    return r.json()["result"]


def _parse(result: str) -> list[dict]:
    """Extrae [{t, az, el}] del bloque entre $$SOE y $$EOE."""
    try:
        body = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    except IndexError:
        raise RuntimeError(f"Respuesta de Horizons sin datos:\n{result[:500]}")
    points = []
    for line in body.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # fecha = "YYYY-Mon-DD HH:MM"; luego flags no-numéricos; az y el son floats
        m = re.match(r"(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2})", line)
        if not m:
            continue
        dt = datetime.strptime(m.group(1), "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        nums = _FLOAT.findall(line[m.end():])
        if len(nums) < 2:
            continue
        points.append({"t": dt.isoformat(), "az": float(nums[0]), "el": float(nums[1])})
    return points


def fetch_site(lat: float, lon: float, start: str, stop: str, step: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for target, cmd in TARGETS.items():
        result = _query(cmd, lat, lon, start, stop, step)
        points = _parse(result)
        out = CACHE_DIR / f"{lat:+.4f}_{lon:+.4f}_{target}.json"
        out.write_text(json.dumps(
            {"site": {"lat": lat, "lon": lon}, "target": target,
             "start": start, "stop": stop, "step": step, "points": points},
            indent=1,
        ))
        print(f"  {target}: {len(points)} puntos → {out.name}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--days", type=int, default=35)
    ap.add_argument("--step", default="20m")
    args = ap.parse_args()

    start = args.start
    stop = (datetime.strptime(start, "%Y-%m-%d") + timedelta(days=args.days)).strftime("%Y-%m-%d")
    print(f"Rango {start} → {stop}, paso {args.step}")
    for s in SEED_SITES:
        print(f"[{s['name']}] lat={s['lat']} lon={s['lon']}")
        fetch_site(s["lat"], s["lon"], start, stop, args.step)


if __name__ == "__main__":
    main()
