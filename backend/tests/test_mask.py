"""TDD del núcleo físico: máscara h(az) (SPEC §3.3)."""

import math

import numpy as np
import pytest

from mask import compute_mask, mask_to_contract

# Base ortonormal de prueba en píxeles: Norte = fila que decrece (arriba),
# Este = columna que crece. az=0 → norte, az=90 → este.
NORTH = (-1.0, 0.0)
EAST = (0.0, 1.0)
MPP = 80.0
R = 1_737_400.0


def _az_index(n_az: int, az_deg: float) -> int:
    return int(round(az_deg / (360.0 / n_az))) % n_az


def test_flat_terrain_mask_is_near_zero():
    """Terreno plano → h(az) ≈ 0 en todo azimut (apenas negativo por curvatura)."""
    z = np.zeros((101, 101))
    h = compute_mask(z, 50, 50, NORTH, EAST, MPP, n_az=72, max_km=3.0)
    assert h.shape == (72,)
    assert np.all(np.abs(h) < 0.05), f"max |h| = {np.max(np.abs(h))}"


def test_wall_to_the_east_peaks_at_az_90():
    """Un muro al Este eleva el horizonte cerca de az=90° y deja el resto ~0."""
    z = np.zeros((101, 101))
    z[:, 70:] = 100.0                      # muro de 100 m al este del centro (col 50)
    h = compute_mask(z, 50, 50, NORTH, EAST, MPP, n_az=360, max_km=3.0)

    i90 = _az_index(360, 90.0)
    assert np.argmax(h) == pytest.approx(i90, abs=2)
    # elevación esperada del muro a 20 px (1600 m): atan2(~99.3, 1600) ≈ 3.5°
    assert h[i90] == pytest.approx(3.55, abs=0.2)
    # al oeste (az=270) no hay muro → ~0
    assert h[_az_index(360, 270.0)] < 0.05


def test_wall_to_the_north_peaks_at_az_0():
    """Un muro al Norte eleva el horizonte cerca de az=0° (chequea la orientación)."""
    z = np.zeros((101, 101))
    z[:30, :] = 100.0                      # muro al norte (filas chicas = norte)
    h = compute_mask(z, 50, 50, NORTH, EAST, MPP, n_az=360, max_km=3.0)
    peak = np.argmax(h)
    assert min(peak, 360 - peak) <= 2, f"pico en az={peak}, esperado ~0"


def test_curvature_lowers_far_horizon():
    """Con curvatura lunar, un feature lejano se ve más abajo que sin curvatura."""
    z = np.zeros((201, 201))
    z[:, 160:] = 50.0                      # muro al este, lejano (~110 px)
    h_curv = compute_mask(z, 100, 100, NORTH, EAST, MPP, n_az=360, max_km=12.0,
                          moon_radius_m=R)
    h_flat = compute_mask(z, 100, 100, NORTH, EAST, MPP, n_az=360, max_km=12.0,
                          moon_radius_m=1e15)     # R enorme ≈ sin curvatura
    i90 = _az_index(360, 90.0)
    assert h_curv[i90] < h_flat[i90]


def test_mask_to_contract_shape():
    z = np.zeros((51, 51))
    h = compute_mask(z, 25, 25, NORTH, EAST, MPP, n_az=360, max_km=1.5)
    contract = mask_to_contract(h)
    assert len(contract) == 360
    assert contract[0]["az"] == 0.0
    assert contract[90]["az"] == 90.0
    assert set(contract[0].keys()) == {"az", "h_deg"}


def test_site_on_nodata_raises():
    z = np.full((21, 21), np.nan)
    with pytest.raises(ValueError):
        compute_mask(z, 10, 10, NORTH, EAST, MPP, n_az=8, max_km=0.5)
