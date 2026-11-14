"""Fondo del mapa: rasters PGDA → PNG precalculado (SPEC §4.1, §5).

Promedios de largo plazo (~18.6 años), NO dependen de la fecha: son la capa base
del mapa ("dónde mirar en promedio"). Se decima, normaliza y cachea como PNG RGBA
(fuera del disco = transparente). El detalle temporal lo da /api/site, no esto.

  illumination / earth → escala de grises (claro = más iluminado / más visible)
  psr                  → overlay celeste translúcido donde hay sombra permanente
"""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

DATA = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = DATA / "map_png"
MAX_PX = 1536                       # tamaño máx. para web (raster original 5058²)

RASTERS = {
    "illumination": "AVGVISIB_85S_060M_201608.TIF",
    "earth": "AVGVISIB_85S_060M_201608_EARTH.TIF",
    "psr": "LPSR_85S_060M_201608.TIF",
}
_MEM: dict[str, bytes] = {}


def _read_decimated(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Lee el raster decimado a ~MAX_PX; devuelve (valores float, máscara válida)."""
    with rasterio.open(path) as ds:
        scale = max(ds.width, ds.height) / MAX_PX
        w, h = int(ds.width / scale), int(ds.height / scale)
        band = ds.read(1, out_shape=(1, h, w)).astype("float64")
        nodata = ds.nodata
    valid = np.isfinite(band)
    if nodata is not None:
        valid &= band != nodata
    return band, valid


def _grayscale_rgba(band: np.ndarray, valid: np.ndarray) -> Image.Image:
    """Normaliza por percentil 99 → gris; inválido = transparente."""
    vmax = np.percentile(band[valid], 99) if valid.any() else 1.0
    vmax = vmax if vmax > 0 else 1.0
    gray = np.clip(band / vmax, 0.0, 1.0) * 255.0
    g = gray.astype("uint8")
    rgba = np.dstack([g, g, g, np.where(valid, 255, 0).astype("uint8")])
    return Image.fromarray(rgba, mode="RGBA")


def _psr_rgba(band: np.ndarray, valid: np.ndarray) -> Image.Image:
    """Sombra permanente (valor > 0) → celeste translúcido; resto transparente."""
    psr = valid & (band > 0)
    h, w = band.shape
    rgba = np.zeros((h, w, 4), dtype="uint8")
    rgba[psr] = (80, 160, 255, 150)
    return Image.fromarray(rgba, mode="RGBA")


def get_map_png(metric: str) -> bytes:
    """PNG (bytes) del raster pedido. Cache en memoria → disco → render."""
    if metric not in RASTERS:
        raise KeyError(metric)
    if metric in _MEM:
        return _MEM[metric]

    out = CACHE_DIR / f"{metric}.png"
    if out.exists():
        data = out.read_bytes()
        _MEM[metric] = data
        return data

    band, valid = _read_decimated(DATA / RASTERS[metric])
    img = _psr_rgba(band, valid) if metric == "psr" else _grayscale_rgba(band, valid)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = buf.getvalue()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    _MEM[metric] = data
    return data
