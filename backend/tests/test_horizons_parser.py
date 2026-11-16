"""Parser de Horizons contra una respuesta REAL guardada (SPEC §4.3).

Fixture: Tierra vista desde (lat -89.9, lon 0) el 2026-11-20 00:00–03:00, paso 1 h,
bajada de ssd.jpl.nasa.gov/api/horizons.api con los mismos parámetros que fetch_horizons.
"""

from pathlib import Path

import pytest

import constants
from fetch_horizons import _parse

FIXTURE = Path(__file__).parent / "fixtures" / "horizons_earth_sample.txt"


def _result() -> str:
    return FIXTURE.read_text(encoding="utf-8")


def test_parse_real_response_points():
    pts = _parse(_result())
    assert len(pts) == 4
    assert pts[0] == {"t": "2026-11-20T00:00:00+00:00", "az": 352.760726, "el": 3.270999}
    assert pts[-1] == {"t": "2026-11-20T03:00:00+00:00", "az": 352.755522, "el": 3.429896}


def test_parse_ignores_flag_columns():
    """Las columnas de flags ('*i') no deben colarse como az/el."""
    for p in _parse(_result()):
        assert 0.0 <= p["az"] < 360.0
        assert -90.0 <= p["el"] <= 90.0


def test_parse_without_soe_block_raises():
    with pytest.raises(RuntimeError):
        _parse("No ephemeris for target body.")


def test_declared_ephemeris_matches_horizons_response():
    """La constante del repo debe coincidir con la efeméride que Horizons dice usar."""
    assert f"{{source: {constants.EPHEMERIS}}}" in _result()
