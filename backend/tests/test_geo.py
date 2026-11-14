"""Tests de geo + integración de la máscara sobre el DEM real (SPEC §4.2)."""

import numpy as np
import pytest

import geo
from mask import compute_mask

_HAS_DEM = geo.DEM_PATH.exists()
needs_dem = pytest.mark.skipif(not _HAS_DEM, reason="DEM no descargado (ver fetch_data.sh)")


@needs_dem
def test_roundtrip_lonlat_pixel():
    """lon/lat → (row,col) → xy debe ser consistente y caer dentro del DEM."""
    lon, lat = 0.0, -89.9
    r, c = geo.lonlat_to_rowcol(lon, lat)
    z = geo.dem_array()
    assert 0 <= r < z.shape[0] and 0 <= c < z.shape[1]


@needs_dem
def test_pole_maps_near_center():
    """El polo sur (lat -90) cae ~en el centro del casquete."""
    r, c = geo.lonlat_to_rowcol(0.0, -90.0)
    z = geo.dem_array()
    assert r == pytest.approx(z.shape[0] / 2, abs=2)
    assert c == pytest.approx(z.shape[1] / 2, abs=2)


@needs_dem
def test_local_dirs_are_near_orthonormal():
    """Norte y Este locales ~ortogonales y unitarios (convergencia polar leve)."""
    N, E = geo.local_dirs_px(0.0, -89.9)
    assert abs(N[0] ** 2 + N[1] ** 2 - 1.0) < 1e-6
    assert abs(E[0] ** 2 + E[1] ** 2 - 1.0) < 1e-6
    assert abs(N[0] * E[0] + N[1] * E[1]) < 0.1


@needs_dem
def test_mask_on_real_site_is_plausible():
    """Máscara de Shackleton: 360 muestras finitas, en rango físico razonable."""
    lon, lat = 0.0, -89.9
    r, c = geo.lonlat_to_rowcol(lon, lat)
    N, E = geo.local_dirs_px(lon, lat)
    h = compute_mask(geo.dem_array(), r, c, N, E, geo.mpp(), n_az=360, max_km=50.0)
    assert h.shape == (360,)
    assert np.all(np.isfinite(h))
    assert h.min() > -45.0 and h.max() < 45.0      # borde de cráter, no absurdo
    assert h.max() > 2.0                            # hay pared de cráter visible
