"""DEM polar: apertura, CRS y transform de coordenadas (SPEC §3.0, §4.2, §5).

Lee CRS y transform de los METADATOS del raster (no asume meridiano/paralelo) y
reusa esa definición en pyproj. Provee:
  - lon/lat → píxel (row, col)
  - direcciones locales Norte y Este en espacio de PÍXELES, calculadas con pyproj
    (no a mano): así el azimut 0=N horario de la máscara coincide exactamente con
    el de los tracks de Horizons. Ese alineamiento es el bug más caro del proyecto.
"""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _resolve_data_path(filename: str) -> Path:
    target = DATA_DIR / filename
    if target.exists():
        return target
    stem = Path(filename).stem
    for ext in (".TIF", ".tif", ".tiff", ".TIFF"):
        cand = DATA_DIR / f"{stem}{ext}"
        if cand.exists():
            return cand
    return target


DEM_PATH = _resolve_data_path("LDEM_80S_80MPP_ADJ.TIF")


@lru_cache(maxsize=1)
def _dem():
    """Carga el DEM una vez: (array z, affine transform, mpp, transformer lonlat→xy)."""
    if not DEM_PATH.exists():
        raise FileNotFoundError(
            f"Falta el DEM en {DEM_PATH}. Descargalo con download_dem.sh (H0)."
        )
    ds = rasterio.open(DEM_PATH)
    z = ds.read(1).astype("float64")        # metros; nodata = NaN
    transform = ds.transform
    mpp = float(abs(transform.a))           # metros por píxel (80)
    crs = CRS.from_user_input(ds.crs)
    tf = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    ds.close()
    return z, transform, mpp, tf


def dem_array() -> np.ndarray:
    return _dem()[0]


def mpp() -> float:
    return _dem()[2]


def _norm_lon(lon: float) -> float:
    """pyproj espera lon en (-180, 180]; los sitios vienen en [0, 360)."""
    return lon - 360.0 if lon > 180.0 else lon


def lonlat_to_xy(lon: float, lat: float) -> tuple[float, float]:
    """lon/lat (grados) → coordenadas proyectadas (metros) en el CRS del DEM."""
    _, _, _, tf = _dem()
    x, y = tf.transform(_norm_lon(lon), lat)
    return float(x), float(y)


def xy_to_rowcol(x: float, y: float) -> tuple[float, float]:
    """Metros proyectados → (row, col) fraccionarios vía el affine inverso."""
    _, transform, _, _ = _dem()
    col, row = (~transform) @ (x, y)
    return row, col


def lonlat_to_rowcol(lon: float, lat: float) -> tuple[float, float]:
    x, y = lonlat_to_xy(lon, lat)
    return xy_to_rowcol(x, y)


def local_dirs_px(lon: float, lat: float, eps_deg: float = 0.01
                  ) -> tuple[tuple[float, float], tuple[float, float]]:
    """Versores Norte y Este LOCALES en espacio de píxeles: ((drow,dcol)_N, (..)_E).

    Se obtienen proyectando puntos a lat+eps (norte) y lon+eps (este) con pyproj y
    midiendo el desplazamiento en la grilla. Robusto a la distorsión polar y a la
    orientación de los ejes: no razonamos la geometría a mano.
    """
    r0, c0 = lonlat_to_rowcol(lon, lat)
    rN, cN = lonlat_to_rowcol(lon, lat + eps_deg)          # hacia el norte
    # este: escalar eps por cos(lat) para un paso real comparable cerca del polo
    dlon = eps_deg / max(math.cos(math.radians(lat)), 1e-6)
    rE, cE = lonlat_to_rowcol(lon + dlon, lat)             # hacia el este

    def _unit(dr: float, dc: float) -> tuple[float, float]:
        n = math.hypot(dr, dc)
        return (dr / n, dc / n) if n > 0 else (0.0, 0.0)

    return _unit(rN - r0, cN - c0), _unit(rE - r0, cE - c0)
