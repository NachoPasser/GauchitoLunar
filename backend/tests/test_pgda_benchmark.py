"""Validación contra PGDA (SPEC §6). Corre solo si hay datos reales y el año de Horizons
cacheado en data/benchmark/ (o con PGDA_BENCH_ONLINE=1, que lo baja de Horizons)."""

import os

import pytest

import benchmark_pgda as bp

_HAS_DATA = (bp.DATA / "LDEM_80S_80MPP_ADJ.tiff").exists() and any(
    (bp.DATA / f"{bp.RASTER_SUN}{e}").exists() for e in (".tiff", ".TIF", ".tif"))
_HAS_YEAR = len(list(bp.CACHE.glob("year_*_sun.json"))) >= len(bp.SEED_SITES) \
    if bp.CACHE.exists() else False
needs_bench = pytest.mark.skipif(
    not (_HAS_DATA and (_HAS_YEAR or os.environ.get("PGDA_BENCH_ONLINE"))),
    reason="faltan datos (DEM/rasters) o el año de Horizons en data/benchmark/")


def test_verdict_rules():
    assert bp.verdict(31.0, (30.3, 29.0, 32.8)) == "PASS"
    assert bp.verdict(33.7, (39.6, 30.8, 40.3)) == "RANGE"
    assert bp.verdict(22.1, (9.7, 0.0, 51.3)) == "NOCOMP"
    assert bp.verdict(50.0, (30.0, 29.0, 32.0)) == "FAIL"


@needs_bench
def test_sun_matches_pgda_where_comparable():
    """Sin FAIL, y los sitios con vecinos estables dentro de ±3 pts de la NASA."""
    rows = {r["name"]: r for r in bp.run()}
    assert not [n for n, r in rows.items() if r["verdict"] == "FAIL"]
    for name in ("Shackleton (borde)", "Connecting Ridge", "Nobile Rim", "Haworth"):
        r = rows[name]
        assert abs(r["sun"] - r["sun_nasa"][0]) <= bp.SUN_TOL_PTS, (name, r)
