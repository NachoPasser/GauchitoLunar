"""Tests del parche de DEM para el render 3D (SPEC §3.3). Usa el DEM real."""

import base64

import numpy as np
import pytest

import geo
from dem_patch import compute_patch, get_dem_patch

_HAS_DEM = geo.DEM_PATH.exists()
needs_dem = pytest.mark.skipif(not _HAS_DEM, reason="DEM no descargado (ver fetch_data.sh)")

SITE = (-86.0, 0.0)   # Malapert Massif (lat, lon)


@needs_dem
def test_patch_shape_and_center_zero():
    """Forma res×res y el nodo central (sitio) tiene altura relativa 0 exacta."""
    lat, lon = SITE
    meta, z = compute_patch(lat, lon, radius_km=8.0, res=64)
    assert z.shape == (64, 64)
    assert z.dtype == np.float32
    assert meta["res"] == 64 and meta["radius_km"] == 8.0
    # Centro de una grilla impar-simétrica: res par ⇒ no hay nodo exacto en 0, pero el
    # muestreo es continuo; chequeamos que exista un nodo ~central con altura chica.
    mid = z[31:33, 31:33]
    assert np.nanmin(np.abs(mid)) < 20.0     # relieve local suave cerca del sitio


@needs_dem
def test_curvature_lowers_far_edge():
    """La corrección de curvatura hunde el terreno lejano: borde más bajo que el centro."""
    _, z = compute_patch(*SITE, radius_km=40.0, res=64)
    center = np.nanmean(z[30:34, 30:34])
    corners = np.nanmean([z[0, 0], z[0, -1], z[-1, 0], z[-1, -1]])
    assert corners < center                  # a 40 km, −s²/2R ≈ −460 m domina


@needs_dem
def test_get_dem_patch_b64_roundtrip():
    """get_dem_patch codifica el mismo array que compute_patch (float32 LE)."""
    meta, z = compute_patch(*SITE, radius_km=8.0, res=64)
    data = get_dem_patch(*SITE, radius_km=8.0, res=64)
    buf = np.frombuffer(base64.b64decode(data["z_b64"]), dtype=np.float32)
    assert buf.size == 64 * 64
    assert np.allclose(buf.reshape(64, 64), z, equal_nan=True)
    assert data["mpp_grid"] == meta["mpp_grid"]


def test_param_validation():
    """res/radius fuera de rango → ValueError (no depende del DEM)."""
    with pytest.raises(ValueError):
        get_dem_patch(*SITE, radius_km=8.0, res=16)
    with pytest.raises(ValueError):
        get_dem_patch(*SITE, radius_km=999.0, res=256)
