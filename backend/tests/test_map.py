"""Tests de /api/map (SPEC §4.1, §5). Dependen de los rasters descargados."""

import io

import numpy as np
import pytest
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
def test_illumination_has_dark_and_bright_pixels():
    """El raster 85°S es un cuadrado lleno (sin nodata): gris con contraste real."""
    a = np.array(Image.open(io.BytesIO(map_service.get_map_png("illumination"))))
    gray, alpha = a[:, :, 0], a[:, :, 3]
    assert (alpha == 255).all()              # cuadrado completo, sin transparencia
    assert (gray < 50).any() and (gray > 150).any()   # zonas oscuras y brillantes
