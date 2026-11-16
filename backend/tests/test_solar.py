"""TDD: irradiancia con 1/r² y disco solar finito (SPEC §3.1)."""

import math
from datetime import datetime, timezone

import pytest

from constants import SOLAR_CONSTANT_W_M2, SUN_ANGULAR_RADIUS_DEG
from metrics import integrate_energy
from solar import solar_distance_au, solar_disc_fraction, solar_irradiance


def _utc(y, m, d, h=0):
    return datetime(y, m, d, h, tzinfo=timezone.utc)


def test_distance_extremes_match_known_perihelion_and_aphelion():
    """Perihelio ~3-ene (0.9833 UA), afelio ~6-jul (1.0167 UA) en 2026."""
    assert solar_distance_au(_utc(2026, 1, 3)) == pytest.approx(0.98330, abs=3e-4)
    assert solar_distance_au(_utc(2026, 7, 6)) == pytest.approx(1.01670, abs=3e-4)


def test_irradiance_is_inverse_square_and_swings_about_7_percent():
    peri = solar_irradiance(_utc(2026, 1, 3))
    aph = solar_irradiance(_utc(2026, 7, 6))
    assert peri == pytest.approx(SOLAR_CONSTANT_W_M2 / solar_distance_au(_utc(2026, 1, 3)) ** 2)
    assert peri == pytest.approx(1408, abs=3)
    assert aph == pytest.approx(1317, abs=3)


def test_disc_fraction_limits_and_symmetry():
    rho = SUN_ANGULAR_RADIUS_DEG
    assert solar_disc_fraction(0.0, rho) == pytest.approx(0.5)
    assert solar_disc_fraction(rho, rho) == pytest.approx(1.0)
    assert solar_disc_fraction(5 * rho, rho) == 1.0
    assert solar_disc_fraction(-rho, rho) == pytest.approx(0.0)
    x = 0.1
    assert (solar_disc_fraction(x, rho) + solar_disc_fraction(-x, rho)) == pytest.approx(1.0)


def _pt(el, visible):
    return {"t": "2026-11-20T00:00:00+00:00", "az": 10.0, "el": el, "visible": visible}


def test_energy_with_mask_counts_partially_visible_disc():
    """Centro 0.1° bajo el horizonte plano: sin máscara 0 (flag), con disco finito > 0."""
    flat = [0.0] * 360
    track = [_pt(-0.1, False), _pt(-0.1, False)]
    assert integrate_energy(track, 60)["horizontal"] == 0.0
    # centro bajo el horizonte → sin = negativo → factor 0: no hay energía horizontal,
    # pero el panel vertical (cos e ≈ 1) sí recibe el borde superior del disco
    with_mask = integrate_energy(track, 60, flat)
    assert with_mask["vertical_sun_tracking"] > 0.0


def test_energy_with_mask_is_scaled_by_disc_fraction_near_horizon():
    ridge = [1.0] * 360                       # horizonte a 1°
    el = 1.1                                  # centro 0.1° sobre el horizonte
    track = [_pt(el, True), _pt(el, True)]
    base = integrate_energy(track, 600)["horizontal"]     # paso largo: evita el redondeo
    disc = integrate_energy(track, 600, ridge)["horizontal"]
    rho = SUN_ANGULAR_RADIUS_DEG / solar_distance_au(_utc(2026, 11, 20))
    assert disc == pytest.approx(base * solar_disc_fraction(0.1, rho), rel=1e-3)
    assert 0.0 < disc < base


def test_energy_far_above_horizon_unchanged_by_disc():
    flat = [0.0] * 360
    track = [_pt(30.0, True), _pt(30.0, True)]
    assert (integrate_energy(track, 60, flat)["horizontal"]
            == integrate_energy(track, 60)["horizontal"])
    assert math.isfinite(integrate_energy(track, 60, flat)["horizontal"])
