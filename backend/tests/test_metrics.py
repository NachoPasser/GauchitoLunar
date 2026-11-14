"""TDD de energía integrada y métricas (SPEC §3.1, §3.2)."""

import math

import pytest

from constants import SOLAR_CONSTANT_W_M2
from metrics import (compute_metrics, integrate_energy, longest_gap_h,
                     next_set_h, visible_fraction)


def _sun(el, vis, n):
    return [{"t": f"t{i}", "az": 0.0, "el": el, "visible": vis} for i in range(n)]


def test_energy_matches_analytic_rectangle_sum():
    """n puntos visibles a el=30°, paso 60 min → suma rectangular conocida."""
    n, step = 5, 60
    track = _sun(30.0, True, n)
    e = integrate_energy(track, step)
    hours = n * step / 60.0
    exp_h = SOLAR_CONSTANT_W_M2 * math.sin(math.radians(30)) * hours / 1000.0
    exp_v = SOLAR_CONSTANT_W_M2 * math.cos(math.radians(30)) * hours / 1000.0
    assert e["horizontal"] == pytest.approx(exp_h, abs=1e-3)
    assert e["vertical_sun_tracking"] == pytest.approx(exp_v, abs=1e-3)


def test_vertical_beats_horizontal_at_grazing_sun():
    """Sol rasante (e=1.5°): el panel vertical rinde muchísimo más (§3.1)."""
    track = _sun(1.5, True, 10)
    e = integrate_energy(track, 20)
    assert e["vertical_sun_tracking"] > 20 * e["horizontal"]


def test_invisible_points_contribute_zero_energy():
    assert integrate_energy(_sun(45.0, False, 8), 30) == {
        "horizontal": 0.0, "vertical_sun_tracking": 0.0}


def test_visible_fraction():
    track = _sun(10, True, 3) + _sun(10, False, 1)
    assert visible_fraction(track) == pytest.approx(0.75)


def test_longest_gap_counts_longest_run():
    # patrón visible/no: ...FFF (3), ...FF (2) → el más largo = 3 → 3*0.5h
    vis = [True, False, False, False, True, False, False, True]
    track = [{"visible": v} for v in vis]
    assert longest_gap_h(track, 30) == pytest.approx(1.5)   # 3 pasos * 0.5 h


def test_next_set_finds_first_visible_to_invisible_edge():
    vis = [True, True, False, True, False]     # primer ocaso en índice 2
    track = [{"visible": v} for v in vis]
    assert next_set_h(track, 60) == pytest.approx(2.0)      # a las 2 h
    assert next_set_h([{"visible": True}] * 3, 60) is None  # nunca se pone


def test_compute_metrics_has_contract_keys():
    sun = _sun(20, True, 4)
    earth = [{"az": 0.0, "el": 3.0, "visible": True} for _ in range(4)]
    m = compute_metrics(sun, earth, 30)
    assert set(m) == {
        "energy_kwh_m2", "lit_fraction", "longest_night_h", "earth_vis_fraction",
        "longest_comms_gap_h", "next_sunset_h", "next_earthset_h"}
    assert set(m["energy_kwh_m2"]) == {"horizontal", "vertical_sun_tracking"}
