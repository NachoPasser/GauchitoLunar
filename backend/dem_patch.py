"""Parche de DEM por sitio para el render 3D de primera persona (SPEC §3.3, §3.0).

Extrae un heightfield cuadrado, alineado al marco local ENU (Norte/Este), centrado en
el sitio, con alturas RELATIVAS al sitio y corrección de curvatura lunar (Δz − s²/2R),
igual que la máscara. NO depende de la fecha → se cachea por sitio (memoria + disco),
mismo patrón que mask_service / map_service. El frontend construye la malla con esto.

Layout de `z` (row-major, float32): índice i = Norte (−r..+r), j = Este (−r..+r);
metros relativos al sitio; z[centro] ≈ 0. NaN (fuera del DEM/nodata) se rellena con el
piso de curvatura −s²/2R para no romper la malla.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np

import geo
from constants import MOON_RADIUS_M

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "dem_patch"
_MEM: dict[tuple, dict] = {}

RES_MIN, RES_MAX = 64, 512
RADIUS_MIN_KM, RADIUS_MAX_KM = 1.0, 50.0


def _bilinear_grid(z: np.ndarray, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
    """Muestreo bilineal vectorizado de z en (rows, cols) fraccionarios; NaN fuera."""
    H, W = z.shape
    r0 = np.floor(rows).astype(np.int64)
    c0 = np.floor(cols).astype(np.int64)
    fr, fc = rows - r0, cols - c0
    valid = (r0 >= 0) & (c0 >= 0) & (r0 + 1 < H) & (c0 + 1 < W)
    r0c = np.clip(r0, 0, H - 2)
    c0c = np.clip(c0, 0, W - 2)
    z00, z01 = z[r0c, c0c], z[r0c, c0c + 1]
    z10, z11 = z[r0c + 1, c0c], z[r0c + 1, c0c + 1]
    top = z00 * (1 - fc) + z01 * fc
    bot = z10 * (1 - fc) + z11 * fc
    out = top * (1 - fr) + bot * fr
    return np.where(valid, out, np.nan)


def compute_patch(lat: float, lon: float, radius_km: float = 24.0, res: int = 256
                  ) -> tuple[dict, np.ndarray]:
    """Devuelve (meta, z) con z float32 (res×res) de alturas relativas + curvatura.

    Puro y testeable (sin caché ni base64). Lanza ValueError si el sitio cae en
    nodata o fuera del DEM.
    """
    z = geo.dem_array()
    mpp = geo.mpp()
    r0, c0 = geo.lonlat_to_rowcol(lon, lat)
    (nr, nc), (er, ec) = geo.local_dirs_px(lon, lat)

    z0 = _bilinear_grid(z, np.array([r0]), np.array([c0]))[0]
    if np.isnan(z0):
        raise ValueError(f"Sitio sobre nodata o fuera del DEM (lat={lat}, lon={lon})")

    rad_m = radius_km * 1000.0
    axis = np.linspace(-rad_m, rad_m, res)          # metros desde el centro
    north, east = np.meshgrid(axis, axis, indexing="ij")  # north[i,j], east[i,j]
    sn, se = north / mpp, east / mpp                # pasos en píxeles
    rows = r0 + sn * nr + se * er
    cols = c0 + sn * nc + se * ec

    sample = _bilinear_grid(z, rows, cols)
    s2 = north * north + east * east                # distancia² al sitio
    height = sample - z0 - s2 / (2.0 * MOON_RADIUS_M)
    floor = -s2 / (2.0 * MOON_RADIUS_M)             # piso de curvatura para NaN
    height = np.where(np.isnan(height), floor, height).astype(np.float32)

    meta = {
        "res": res,
        "radius_km": radius_km,
        "mpp_grid": 2.0 * rad_m / (res - 1),        # metros por nodo de la grilla
        "z0": float(z0),                            # elevación absoluta del sitio (m)
        "layout": "row-major i=north(-r..+r) j=east(-r..+r), meters rel. site, curv-corr",
    }
    return meta, height


def _cache_path(lat: float, lon: float, radius_km: float, res: int) -> Path:
    return CACHE_DIR / f"{lat:+.4f}_{lon:+.4f}_{radius_km:g}_{res}.json"


def get_dem_patch(lat: float, lon: float, radius_km: float = 24.0, res: int = 256
                  ) -> dict:
    """Parche para /api/dem-patch: meta + `z_b64` (float32 LE, base64). Cacheado."""
    if not (RES_MIN <= res <= RES_MAX):
        raise ValueError(f"res debe estar en [{RES_MIN}, {RES_MAX}]")
    if not (RADIUS_MIN_KM <= radius_km <= RADIUS_MAX_KM):
        raise ValueError(f"radius_km debe estar en [{RADIUS_MIN_KM}, {RADIUS_MAX_KM}]")

    key = (round(lat, 4), round(lon, 4), radius_km, res)
    if key in _MEM:
        return _MEM[key]
    path = _cache_path(lat, lon, radius_km, res)
    if path.exists():
        data = json.loads(path.read_text())
        _MEM[key] = data
        return data

    meta, z = compute_patch(lat, lon, radius_km, res)
    data = {**meta, "z_b64": base64.b64encode(z.tobytes()).decode("ascii")}
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))
    _MEM[key] = data
    return data
