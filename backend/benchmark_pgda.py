"""Benchmark de validación: nuestro modelo vs rasters oficiales PGDA (SPEC §6, honestidad).

Un año completo de efemérides reales de Horizons (paso 1 h) + la máscara del backend
→ % de tiempo con el Sol (y la Tierra) sobre el horizonte, contra el promedio de ~18,6
años de PGDA (AVGVISIB). Es un chequeo de orden de magnitud, no una igualdad exacta:
año vs promedio, DEM 80 m vs 60 m, y la escala del raster (25000 = 100 %) es una
hipótesis a confirmar con la documentación de PGDA.

Veredicto por sitio (Sol):  PASS   |nuestro − NASA(centro)| ≤ SUN_TOL_PTS
                            RANGE  dentro del rango min–max de los 3×3 vecinos
                            NOCOMP vecinos muy dispares (gradiente empinado): no comparable
                            FAIL   ninguna de las anteriores
Uso:  python backend/benchmark_pgda.py   (baja Horizons si falta cache en data/benchmark/)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

import fetch_horizons as fh
from mask_service import get_mask_array
from sites import SEED_SITES
from tracks import h_at

DATA = Path(__file__).resolve().parent.parent / "data"
CACHE = DATA / "benchmark"
RASTER_SUN = "AVGVISIB_85S_060M_201608"
RASTER_EARTH = "AVGVISIB_85S_060M_201608_EARTH"
RASTER_SCALE = 250.0          # int16 25000 = 100 %  (hipótesis, ver docstring)
YEAR = ("2026-11-20", "2027-11-20", "1h")
SUN_TOL_PTS = 3.0
NOCOMP_SPREAD_PTS = 20.0      # min–max de vecinos mayor que esto → no comparable


def year_track(site: dict, target: str) -> list[dict]:
    """Año de Horizons para el sitio; cacheado en data/benchmark/ (fuera del repo)."""
    f = CACHE / f"year_{site['lat']}_{site['lon']}_{target}.json"
    if f.exists():
        return json.loads(f.read_text())
    pts = fh._parse(fh._query(fh.TARGETS[target], site["lat"], site["lon"], *YEAR))
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(pts))
    return pts


def model_pct(points: list[dict], h: list[float]) -> float:
    """% de muestras con el astro (centro) sobre el horizonte h(az)."""
    return 100.0 * sum(p["el"] > h_at(h, p["az"]) for p in points) / len(points)


def nasa_pct(stem: str, site: dict) -> tuple[float, float, float]:
    """(centro, mín, máx) en % del píxel del sitio y sus 3×3 vecinos."""
    for ext in (".tiff", ".TIF", ".tif"):
        if (DATA / f"{stem}{ext}").exists():
            path = DATA / f"{stem}{ext}"
            break
    with rasterio.open(path) as ds:
        crs = CRS.from_wkt(ds.crs.to_wkt())
        x, y = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(
            site["lon"], site["lat"])
        r, c = ds.index(x, y)
        win = ds.read(1)[r - 1:r + 2, c - 1:c + 2].astype(float) / RASTER_SCALE
    return float(win[1, 1]), float(win.min()), float(win.max())


def verdict(ours: float, nasa: tuple[float, float, float]) -> str:
    centre, lo, hi = nasa
    if abs(ours - centre) <= SUN_TOL_PTS:
        return "PASS"
    if hi - lo > NOCOMP_SPREAD_PTS:
        return "NOCOMP"
    return "RANGE" if lo <= ours <= hi else "FAIL"


def run() -> list[dict]:
    rows = []
    for s in SEED_SITES:
        h = get_mask_array(s["lat"], s["lon"])
        sun_n, earth_n = nasa_pct(RASTER_SUN, s), nasa_pct(RASTER_EARTH, s)
        sun = model_pct(year_track(s, "sun"), h)
        rows.append({
            "name": s["name"], "sun": sun, "sun_nasa": sun_n,
            "earth": model_pct(year_track(s, "earth"), h), "earth_nasa": earth_n,
            "verdict": verdict(sun, sun_n),
        })
    return rows


def main() -> int:
    rows = run()
    print(f"Año {YEAR[0]}→{YEAR[1]} vs PGDA. Sol: tolerancia ±{SUN_TOL_PTS} pts\n")
    print(f"{'Sitio':<20}{'Sol':>7}{'NASA':>7}{'[min–max]':>13}  {'Veredicto':<8}"
          f"{'Tierra':>8}{'NASA':>7}  (Tierra: solo informativa, criterio centro)")
    for r in rows:
        c, lo, hi = r["sun_nasa"]
        print(f"{r['name']:<20}{r['sun']:6.1f}%{c:6.1f}%  [{lo:4.1f}–{hi:4.1f}]  "
              f"{r['verdict']:<8}{r['earth']:7.1f}%{r['earth_nasa'][0]:6.1f}%")
    return 1 if any(r["verdict"] == "FAIL" for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
