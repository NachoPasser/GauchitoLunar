"""Tests de /api/map (SPEC §4.1, §5). Dependen de los rasters descargados."""

import io

import numpy as np
import pytest
import rasterio
from PIL import Image

import map_service

_HAS = all((map_service.DATA / f).exists() for f in map_service.RASTERS.values())
needs_rasters = pytest.mark.skipif(not _HAS, reason="rasters no descargados (fetch_data.sh)")


@needs_rasters
@pytest.mark.parametrize("metric", ["illumination", "earth", "psr"])
def test_map_png_is_valid_rgba(metric):
    png = map_service.get_map_png(metric)
    img = Image.open(io.BytesIO(png))
    assert img.format == "PNG"
    assert img.mode == "RGBA"
    assert max(img.size) <= map_service.MAX_PX


@needs_rasters
def test_unknown_metric_raises():
    with pytest.raises(KeyError):
        map_service.get_map_png("nope")


@needs_rasters
def test_map_meta_shape_and_proj():
    m = map_service.get_map_meta("illumination")
    assert m["size_px"][0] <= map_service.MAX_PX
    assert m["proj"]["lat0"] == -90.0 and m["proj"]["lon0"] == 0.0
    b = m["bounds"]
    assert b["left"] < 0 < b["right"] and b["bottom"] < 0 < b["top"]


@needs_rasters
def test_seed_sites_project_inside_bounds():
    """Cada sitio semilla cae dentro de los bounds del raster de fondo (sanity H3)."""
    from pyproj import Transformer

    from sites import SEED_SITES
    m = map_service.get_map_meta("illumination")
    b = m["bounds"]
    with rasterio.open(map_service.DATA / map_service.RASTERS["illumination"]) as ds:
        tf = Transformer.from_crs(ds.crs.geodetic_crs, ds.crs, always_xy=True)
    for s in SEED_SITES:
        lon = s["lon"] - 360.0 if s["lon"] > 180.0 else s["lon"]
        x, y = tf.transform(lon, s["lat"])
        assert b["left"] <= x <= b["right"], s["name"]
        assert b["bottom"] <= y <= b["top"], s["name"]


@needs_rasters
def test_illumination_has_dark_and_bright_pixels():
    """El raster 85°S es un cuadrado lleno (sin nodata): gris con contraste real."""
    a = np.array(Image.open(io.BytesIO(map_service.get_map_png("illumination"))))
    gray, alpha = a[:, :, 0], a[:, :, 3]
    assert (alpha == 255).all()              # cuadrado completo, sin transparencia
    assert (gray < 50).any() and (gray > 150).any()   # zonas oscuras y brillantes
