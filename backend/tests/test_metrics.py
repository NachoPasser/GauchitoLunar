"""TDD de energía integrada y métricas (SPEC §3.1, §3.2)."""

import math
from datetime import datetime, timedelta, timezone

import pytest

from intervals import longest_state_h, sun_intervals
from metrics import compute_metrics, integrate_energy, next_set_h, visible_fraction
from solar import solar_irradiance

T0 = datetime(2026, 11, 20, tzinfo=timezone.utc)


def _t(i, step=30):
    return (T0 + timedelta(minutes=step * i)).isoformat()


def _sun(el, vis, n, step=30):
    return [{"t": _t(i, step), "az": 0.0, "el": el, "visible": vis} for i in range(n)]


def test_energy_matches_analytic_trapezoid_on_constant_sun():
    """n puntos visibles a el=30°, paso 60 min → ventana de (n−1) pasos (trapecio)."""
    n, step = 5, 60
    track = _sun(30.0, True, n, step)
    e = integrate_energy(track, step)
    hours = (n - 1) * step / 60.0           # n muestras abarcan n−1 intervalos
    s = solar_irradiance(T0)                # S = 1361/r² (r≈0.99 UA a fin de noviembre)
    exp_h = s * math.sin(math.radians(30)) * hours / 1000.0
    exp_v = s * math.cos(math.radians(30)) * hours / 1000.0
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


def test_energy_trapezoid_on_linear_ramp_is_exact():
    """Sol que sube linealmente en sin(e): el trapecio integra exacto, el rectángulo no."""
    sins = [0.0, 0.1, 0.2, 0.3]
    track = [{"t": _t(i, 60), "az": 0.0, "el": math.degrees(math.asin(s)), "visible": True}
             for i, s in enumerate(sins)]
    e = integrate_energy(track, 60)
    # ∫ sin e dt = área bajo la rampa 0→0.3 en 3 h = 0.3·3/2 = 0.45 h·(S/1000)
    assert e["horizontal"] == pytest.approx(solar_irradiance(T0) * 0.45 / 1000.0, abs=1e-3)


def test_energy_single_sample_has_no_span():
    assert integrate_energy(_sun(30.0, True, 1), 30)["horizontal"] == 0.0


def test_longest_state_h_matches_interval_duration_at_window_end():
    """Corte que toca el final de la ventana: se mide como el cartucho (sin paso de más)."""
    #        lit   dark  dark  dark  (fin de ventana, 4 muestras a 30 min)
    track = _sun(10, True, 1) + _sun(10, False, 3)
    track = [{**p, "t": _t(i)} for i, p in enumerate(track)]
    ivs = sun_intervals(track)
    dark = [x for x in ivs if x["state"] == "dark"][0]
    assert dark["duration_h"] == pytest.approx(1.0)       # t1→t3: 2 pasos
    assert longest_state_h(ivs, "dark") == pytest.approx(1.0)
    assert longest_state_h([], "dark") == 0.0


def test_compute_metrics_longest_gaps_come_from_intervals():
    sun = _sun(10, True, 2) + _sun(10, False, 3) + _sun(10, True, 1)
    sun = [{**p, "t": _t(i)} for i, p in enumerate(sun)]
    earth = [{"t": _t(i), "az": 0.0, "el": 3.0, "visible": i != 2} for i in range(5)]
    m = compute_metrics(sun, earth, 30)
    assert m["longest_night_h"] == longest_state_h(sun_intervals(sun), "dark") == 1.5
    assert m["longest_comms_gap_h"] == pytest.approx(0.5)


def test_next_set_finds_first_visible_to_invisible_edge():
    vis = [True, True, False, True, False]     # primer ocaso en índice 2
    track = [{"visible": v} for v in vis]
    assert next_set_h(track, 60) == pytest.approx(2.0)      # a las 2 h
    assert next_set_h([{"visible": True}] * 3, 60) is None  # nunca se pone


def test_compute_metrics_has_contract_keys():
    sun = _sun(20, True, 4)
    earth = [{"t": _t(i), "az": 0.0, "el": 3.0, "visible": True} for i in range(4)]
    m = compute_metrics(sun, earth, 30)
    assert set(m) == {
        "energy_kwh_m2", "lit_fraction", "longest_night_h", "earth_vis_fraction",
        "longest_comms_gap_h", "next_sunset_h", "next_earthset_h"}
    assert set(m["energy_kwh_m2"]) == {"horizontal", "vertical_sun_tracking"}
