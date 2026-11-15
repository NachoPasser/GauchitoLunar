"""Tests del fetch en vivo on-miss y del error legible (SPEC §4.3).

Deterministas: NO tocan la red. Mockean fetch_horizons.fetch_site y verifican que
ephem.ensure_cache baje solo cuando falta, y que un fallo se traduzca a 503 con CORS
en /api/site (no un 500 crudo que el browser ve como "Failed to fetch").
"""

import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import ephem

START = datetime(2026, 11, 14, tzinfo=timezone.utc)


def _write_cache(dirpath, lat, lon, target, days=40):
    """Escribe caché mínima que cubre [2026-11-14, 2026-11-14 + days]."""
    from datetime import timedelta
    t0 = datetime(2026, 11, 14, tzinfo=timezone.utc)
    points = [
        {"t": t0.isoformat(), "az": 1.0, "el": 2.0},
        {"t": (t0 + timedelta(days=days)).isoformat(), "az": 1.0, "el": 2.0},
    ]
    p = dirpath / f"{lat:+.4f}_{lon:+.4f}_{target}.json"
    p.write_text(json.dumps({"points": points}))


@pytest.fixture
def tmp_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(ephem, "CACHE_DIR", tmp_path)
    ephem._CACHE.clear()
    return tmp_path


def test_ensure_cache_noop_when_present(tmp_cache, monkeypatch):
    _write_cache(tmp_cache, -89.9, 0.0, "sun")
    _write_cache(tmp_cache, -89.9, 0.0, "earth")
    import fetch_horizons
    monkeypatch.setattr(fetch_horizons, "fetch_site",
                        lambda *a, **k: pytest.fail("no debía fetchear"))
    ephem.ensure_cache(-89.9, 0.0, START)          # no explota = ok


def test_ensure_cache_fetches_on_miss(tmp_cache, monkeypatch):
    calls = []

    def fake_fetch(lat, lon, start, stop, step):
        calls.append((lat, lon, start, stop, step))
        _write_cache(tmp_cache, lat, lon, "sun")
        _write_cache(tmp_cache, lat, lon, "earth")

    import fetch_horizons
    monkeypatch.setattr(fetch_horizons, "fetch_site", fake_fetch)
    ephem.ensure_cache(-86.5, 120.0, START, days=14)
    assert len(calls) == 1
    assert ephem.has_cache(-86.5, 120.0, "sun")
    assert ephem.has_cache(-86.5, 120.0, "earth")


def test_ensure_cache_wraps_network_error(tmp_cache, monkeypatch):
    import fetch_horizons

    def boom(*a, **k):
        raise ConnectionError("sin red en el venue")

    monkeypatch.setattr(fetch_horizons, "fetch_site", boom)
    with pytest.raises(ephem.EphemerisError):
        ephem.ensure_cache(-86.5, 120.0, START)


def test_site_api_ephem_error_is_503_with_cors(monkeypatch):
    """Sin red, /api/site devuelve 503 legible y CON header CORS (no 500 crudo)."""
    import main
    import site_service

    def boom(*a, **k):
        raise ephem.EphemerisError("sin cache y sin red")

    monkeypatch.setattr(site_service, "get_site", boom)
    c = TestClient(main.app)
    r = c.get("/api/site?lat=-86.5&lon=120",
              headers={"Origin": "http://localhost:5500"})
    assert r.status_code == 503
    assert "sin cache y sin red" in r.json()["detail"]
    assert r.headers.get("access-control-allow-origin") == "*"
