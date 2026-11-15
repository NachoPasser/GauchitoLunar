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
from rasterio.enums import Resampling
from PIL import Image

DATA = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = DATA / "map_png"
MAX_PX = 1536                       # tamaño máx. para web (raster original 5058²)


def _resolve_data_path(filename: str) -> Path:
    target = DATA / filename
    if target.exists():
        return target
    stem = Path(filename).stem
    for ext in (".TIF", ".tif", ".tiff", ".TIFF"):
        cand = DATA / f"{stem}{ext}"
        if cand.exists():
            return cand
    return target


RASTERS = {
    "illumination": "AVGVISIB_85S_060M_201608.TIF",
    "earth": "AVGVISIB_85S_060M_201608_EARTH.TIF",
    "psr": "LPSR_85S_060M_201608.TIF",
}
# El hillshade NO es un raster propio: se deriva del DEM (relieve sombreado). Cubre más
# latitud (hasta ~80°S) → sirve de "luna de fondo" alrededor del casquete de iluminación.
DEM_FILE = "LDEM_80S_80MPP_ADJ.TIF"
_MEM: dict[str, bytes] = {}


def _read_decimated(path: Path, resampling=Resampling.nearest
                    ) -> tuple[np.ndarray, np.ndarray]:
    """Lee el raster decimado a ~MAX_PX; devuelve (valores float, máscara válida).
    `resampling=average` promedia el bloque (suaviza, clave para el hillshade del DEM)."""
    with rasterio.open(path) as ds:
        scale = max(ds.width, ds.height) / MAX_PX
        w, h = int(ds.width / scale), int(ds.height / scale)
        band = ds.read(1, out_shape=(1, h, w), resampling=resampling).astype("float64")
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


def _decimated_mpp(path: Path) -> float:
    """Metros/píxel del raster YA decimado a ~MAX_PX."""
    with rasterio.open(path) as ds:
        scale = max(ds.width, ds.height) / MAX_PX
        return abs(ds.transform.a) * scale


def _match_hist(src: np.ndarray, tmpl: np.ndarray) -> np.ndarray:
    """Mapea `src` para que su distribución iguale la de `tmpl` (512 cuantiles)."""
    qs = np.linspace(0.0, 1.0, 512)
    s_q = np.quantile(src, qs)
    t_q = np.quantile(tmpl, qs)
    s_q = np.maximum.accumulate(s_q) + np.arange(512) * 1e-9   # estrictamente creciente
    return np.interp(src, s_q, t_q)


def _illum_template() -> np.ndarray:
    """Distribución de grises [0,1] del casquete AVGVISIB (para igualar el hillshade)."""
    band, valid = _read_decimated(_resolve_data_path(RASTERS["illumination"]))
    vmax = np.percentile(band[valid], 99) if valid.any() else 1.0
    return np.clip(band[valid] / (vmax or 1.0), 0.0, 1.0)


def _hillshade_rgba(band: np.ndarray, valid: np.ndarray, mpp: float) -> Image.Image:
    """Relieve sombreado MULTIDIRECCIONAL (promedio de 16 azimuts) del DEM, con el
    histograma de grises IGUALADO al del casquete AVGVISIB → mismo tono/contraste
    (negros profundos + bordes claros). El DEM se lee PROMEDIADO (anti-aliasing) para que
    la igualación no genere speckle. Inválido = transparente."""
    fill = float(np.median(band[valid])) if valid.any() else 0.0
    z = np.where(valid, band, fill)
    dzdy, dzdx = np.gradient(z, mpp)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(dzdy, -dzdx)
    alt = np.radians(18.0)
    acc = np.zeros_like(z)
    for k in range(16):
        az = 2.0 * np.pi * k / 16.0
        acc += np.clip(np.sin(alt) * np.cos(slope)
                       + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0.0, None)
    acc /= 16.0
    matched = _match_hist(acc[valid], _illum_template())
    g = np.zeros(acc.shape, dtype="uint8")
    g[valid] = (np.clip(matched, 0.0, 1.0) * 255.0).astype("uint8")
    rgba = np.dstack([g, g, g, np.where(valid, 255, 0).astype("uint8")])
    return Image.fromarray(rgba, mode="RGBA")


def _psr_rgba(band: np.ndarray, valid: np.ndarray) -> Image.Image:
    """Sombra permanente (valor > 0) → celeste translúcido; resto transparente."""
    psr = valid & (band > 0)
    h, w = band.shape
    rgba = np.zeros((h, w, 4), dtype="uint8")
    rgba[psr] = (80, 160, 255, 150)
    return Image.fromarray(rgba, mode="RGBA")


def get_map_meta(metric: str = "illumination") -> dict:
    """Geo-metadatos del fondo del mapa para proyectar lat/lon → píxel en el front.

    Lee CRS/bounds de los METADATOS del raster (no los asume, §3.0). El PNG se
    decima pero conserva la extensión: los bounds proyectados valen para ambos.
    `proj` describe la estereográfica polar sur esférica que el front reusa.
    """
    if metric == "hillshade":
        path = _resolve_data_path(DEM_FILE)
    elif metric in RASTERS:
        path = _resolve_data_path(RASTERS[metric])
    else:
        raise KeyError(metric)
    with rasterio.open(path) as ds:
        b = ds.bounds
        crs = ds.crs.to_dict()
        scale = max(ds.width, ds.height) / MAX_PX
        size = [int(ds.width / scale), int(ds.height / scale)]
    return {
        "metric": metric,
        "size_px": size,
        "bounds": {"left": b.left, "bottom": b.bottom, "right": b.right, "top": b.top},
        "proj": {
            "type": "stere",
            "R": crs.get("R", 1737400.0),
            "lat0": crs.get("lat_0", -90.0),
            "lat_ts": crs.get("lat_ts", -90.0),
            "lon0": crs.get("lon_0", 0.0),
        },
    }


def get_map_png(metric: str) -> bytes:
    """PNG (bytes) del raster pedido. Cache en memoria → disco → render."""
    if metric != "hillshade" and metric not in RASTERS:
        raise KeyError(metric)
    if metric in _MEM:
        return _MEM[metric]

    out = CACHE_DIR / f"{metric}.png"
    if out.exists():
        data = out.read_bytes()
        _MEM[metric] = data
        return data

    if metric == "hillshade":
        dem_path = _resolve_data_path(DEM_FILE)
        band, valid = _read_decimated(dem_path, Resampling.average)
        img = _hillshade_rgba(band, valid, _decimated_mpp(dem_path))
    else:
        band, valid = _read_decimated(_resolve_data_path(RASTERS[metric]))
        img = _psr_rgba(band, valid) if metric == "psr" else _grayscale_rgba(band, valid)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = buf.getvalue()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    _MEM[metric] = data
    return data
