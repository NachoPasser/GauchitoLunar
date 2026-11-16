"""Robustez del backend: caché por rangos que no pisa lo precalculado, validación de entradas
con 422 legibles, errores internos como 500 JSON CON CORS y el chequeo /api/health.

Deterministas: no tocan la red ni los datos reales (mockean fetch_horizons.fetch_site).
"""

import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import ephem

T0 = datetime(2026, 11, 14, tzinfo=timezone.utc)
FAR = datetime(2030, 3, 1, tzinfo=timezone.utc)


def _write(dirpath, lat, lon, target, start, days, az, tag=""):
    """Escribe un rango cacheado mínimo [start, start+days] con un az reconocible."""
    pts = [{"t": start.isoformat(), "az": az, "el": 1.0},
           {"t": (start + timedelta(days=days)).isoformat(), "az": az, "el": 1.0}]
    p = dirpath / f"{lat:+.4f}_{lon:+.4f}_{target}{tag}.json"
    p.write_text(json.dumps({"points": pts}))
    return p


@pytest.fixture
def tmp_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(ephem, "CACHE_DIR", tmp_path)
    ephem._CACHE.clear()
    return tmp_path


def _fake_fetch(tmp_cache, az):
    def fetch(lat, lon, start, stop, step, tag=""):
        s = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        e = datetime.strptime(stop, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        for tgt in ("sun", "earth"):
            _write(tmp_cache, lat, lon, tgt, s, (e - s).days, az, tag)
    return fetch


def test_live_fetch_of_other_dates_does_not_overwrite_base(tmp_cache, monkeypatch):
    """Explorar fechas lejanas baja un rango EXTRA; el base precalculado queda intacto."""
    base = _write(tmp_cache, -89.9, 0.0, "sun", T0, 40, az=11.0)
    _write(tmp_cache, -89.9, 0.0, "earth", T0, 40, az=11.0)
    before = base.read_text()
    import fetch_horizons
    monkeypatch.setattr(fetch_horizons, "fetch_site", _fake_fetch(tmp_cache, az=99.0))

    ephem.ensure_cache(-89.9, 0.0, FAR, days=10)

    assert base.read_text() == before                     # el base no se tocó
    assert len(ephem._extra_paths(-89.9, 0.0, "sun")) == 1
    # ambos rangos quedan cubiertos y cada fecha sale de SU rango
    assert ephem._cache_covers(-89.9, 0.0, "sun", T0, 30)
    assert ephem._cache_covers(-89.9, 0.0, "sun", FAR, 10)
    site = {"lat": -89.9, "lon": 0.0}
    assert ephem.ephem(site, T0 + timedelta(days=5))[0] == pytest.approx(11.0)
    assert ephem.ephem(site, FAR + timedelta(days=2))[0] == pytest.approx(99.0)


def test_covered_range_does_not_fetch_again(tmp_cache, monkeypatch):
    _write(tmp_cache, -89.9, 0.0, "sun", T0, 40, az=11.0)
    _write(tmp_cache, -89.9, 0.0, "earth", T0, 40, az=11.0)
    import fetch_horizons
    monkeypatch.setattr(fetch_horizons, "fetch_site",
                        lambda *a, **k: pytest.fail("no debía fetchear"))
    ephem.ensure_cache(-89.9, 0.0, T0 + timedelta(days=3), days=20)


def test_extra_ranges_are_capped(tmp_cache, monkeypatch):
    """Los rangos extra no crecen sin límite: quedan los MAX_EXTRA_RANGES más nuevos."""
    _write(tmp_cache, -89.9, 0.0, "sun", T0, 40, az=11.0)
    _write(tmp_cache, -89.9, 0.0, "earth", T0, 40, az=11.0)
    import fetch_horizons
    monkeypatch.setattr(fetch_horizons, "fetch_site", _fake_fetch(tmp_cache, az=99.0))
    for i in range(ephem.MAX_EXTRA_RANGES + 3):
        ephem.ensure_cache(-89.9, 0.0, FAR + timedelta(days=100 * i), days=5)
    assert len(ephem._extra_paths(-89.9, 0.0, "sun")) == ephem.MAX_EXTRA_RANGES
    assert ephem.has_cache(-89.9, 0.0, "sun")             # el base sigue ahí


# ── API ────────────────────────────────────────────────────────────────────────────────────
@pytest.fixture
def client():
    import main
    return TestClient(main.app, raise_server_exceptions=False)


@pytest.mark.parametrize("url", [
    "/api/site?lat=-70&lon=10",                      # fuera del DEM
    "/api/site?lat=10&lon=10",
    "/api/mask?lat=-70&lon=10",
    "/api/site?lat=-86.5&lon=120&date=basura",       # fecha inválida
    "/api/site?lat=-86.5&lon=120&window_days=0",
    "/api/site?lat=-86.5&lon=120&window_days=400",   # sin tope colgaba el cálculo
    "/api/site?lat=-86.5&lon=120&comms_margin_deg=9",
])
def test_invalid_inputs_are_422_not_500(client, url):
    r = client.get(url, headers={"Origin": "http://localhost:5500"})
    assert r.status_code == 422
    assert r.headers.get("access-control-allow-origin") == "*"


def test_unhandled_error_is_json_500_with_cors(client, monkeypatch):
    """Una excepción inesperada sale como 500 JSON con CORS, no como un 'Failed to fetch'."""
    import site_service

    def boom(*a, **k):
        raise RuntimeError("fallo inesperado")

    monkeypatch.setattr(site_service, "get_site", boom)
    r = client.get("/api/site?lat=-86.5&lon=120", headers={"Origin": "http://localhost:5500"})
    assert r.status_code == 500
    assert "detail" in r.json()
    assert r.headers.get("access-control-allow-origin") == "*"


def test_health_reports_readiness(client, monkeypatch):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"ready", "missing", "warnings"}
    assert isinstance(body["ready"], bool) and isinstance(body["missing"], list)
    # sin DEM → no listo y lo dice
    import geo
    from pathlib import Path
    monkeypatch.setattr(geo, "DEM_PATH", Path("no-existe.tif"))
    body = client.get("/api/health").json()
    assert body["ready"] is False and "dem" in body["missing"]


def test_health_only_blocks_on_required_data(client, monkeypatch):
    """Un raster que la UI no usa (psr/earth) no bloquea; el de iluminación sí."""
    import map_service
    real = map_service._resolve_data_path

    def without(metric_file):
        def fake(fname):
            p = real(fname)
            return __import__("pathlib").Path("no-existe.tif") if fname == metric_file else p
        return fake

    monkeypatch.setattr(map_service, "_resolve_data_path",
                        without(map_service.RASTERS["psr"]))
    body = client.get("/api/health").json()
    assert "raster:psr" in body["warnings"] and "raster:psr" not in body["missing"]

    monkeypatch.setattr(map_service, "_resolve_data_path",
                        without(map_service.RASTERS["illumination"]))
    body = client.get("/api/health").json()
    assert body["ready"] is False and "raster:illumination" in body["missing"]


def test_interp_with_precomputed_times_matches_and_wraps_azimuth():
    """_interp con los epochs ya calculados da lo mismo que sin ellos (y respeta el wrap 360->0)."""
    track = [(0.0, 350.0, 1.0), (100.0, 10.0, 3.0), (200.0, 30.0, 5.0)]
    times = [r[0] for r in track]
    for epoch in (-5.0, 0.0, 50.0, 100.0, 150.0, 200.0, 999.0):
        assert ephem._interp(track, epoch, times) == ephem._interp(track, epoch)
    az, el = ephem._interp(track, 50.0, times)
    assert az == pytest.approx(0.0, abs=1e-9) and el == pytest.approx(2.0)   # 350 -> 10 por el camino corto
