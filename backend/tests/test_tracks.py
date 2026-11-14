"""TDD de la condición de visibilidad y los tracks (SPEC §3.2)."""

from datetime import datetime, timezone
from pathlib import Path

import pytest

import ephem as ephem_mod
from tracks import build_tracks, h_at, is_visible

# máscara sintética de 360: horizonte a 5° salvo una cresta de 20° en az=90°
H = [5.0] * 360
H[90] = 20.0


def test_h_at_picks_nearest_sample():
    assert h_at(H, 0.0) == 5.0
    assert h_at(H, 90.0) == 20.0
    assert h_at(H, 90.4) == 20.0       # redondea a la muestra 90
    assert h_at(H, 359.6) == 5.0       # wrap a 0


def test_is_visible_condition():
    # sobre horizonte llano (5°)
    assert is_visible(6.0, 0.0, H, margin_deg=0.0) is True
    assert is_visible(4.0, 0.0, H, margin_deg=0.0) is False
    # el margen de comms endurece la condición
    assert is_visible(5.3, 0.0, H, margin_deg=0.5) is False
    # detrás de la cresta de 20° en az=90 no se ve aunque el=10
    assert is_visible(10.0, 90.0, H, margin_deg=0.0) is False


_CACHE = ephem_mod.CACHE_DIR / "-89.9000_+0.0000_sun.json"
needs_cache = pytest.mark.skipif(
    not _CACHE.exists(), reason="cache de Horizons ausente (ver fetch_horizons.py)")


@needs_cache
def test_build_tracks_shape_and_pole_physics():
    """En el polo la Tierra queda pegada al horizonte y las flags son coherentes."""
    site = {"lat": -89.9, "lon": 0.0}
    sun, earth = build_tracks(site, H, datetime(2026, 11, 15, tzinfo=timezone.utc),
                              window_days=2, margin_deg=0.0, step_min=20)
    assert len(sun) == len(earth) == int(2 * 24 * 60 / 20) + 1
    assert set(sun[0]) == {"t", "az", "el", "visible"}
    # Tierra oscila pegada al horizonte (libración ±~7° + offset de latitud)
    assert all(abs(p["el"]) < 15.0 for p in earth)
    # coherencia: visible ⟺ el > h(az)
    for p in earth:
        assert p["visible"] == is_visible(p["el"], p["az"], H, 0.0)
