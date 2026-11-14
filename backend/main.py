"""FastAPI — esqueleto H0 (SPEC §5).

Levanta y sirve el contrato de API contra las fixtures de mocks/ para desbloquear
al frontend sin backend real. En H1 cada endpoint se reemplaza por el cálculo real
(máscara, tracks, métricas) manteniendo EXACTAMENTE la misma forma de respuesta.

Correr:  uvicorn main:app --reload   (desde backend/)
Docs:    http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from constants import COMMS_MARGIN_DEFAULT_DEG, WINDOW_DAYS_DEFAULT
from sites import SEED_SITES

MOCKS_DIR = Path(__file__).resolve().parent / "mocks"

app = FastAPI(title="Lunar Landing Site Navigator", version="0.0-h0")

# El frontend vanilla corre desde file:// o un server estático aparte.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _mock(name: str) -> dict:
    return json.loads((MOCKS_DIR / name).read_text())


@app.get("/")
def health() -> dict:
    return {"status": "ok", "service": "lunar-nav", "stage": "h0-mock"}


@app.get("/api/sites")
def sites() -> dict:
    """Sitios semilla para poblar el mapa (no está en el contrato §5, utilitario)."""
    return {"sites": SEED_SITES}


@app.get("/api/mask")
def mask(lat: float = Query(...), lon: float = Query(...)) -> JSONResponse:
    """MOCK del contrato §5. H1: ray casting real sobre el DEM."""
    data = _mock("mask.json")
    data["site"]["lat"] = lat
    data["site"]["lon"] = lon
    return JSONResponse(data)


@app.get("/api/site")
def site(
    lat: float = Query(...),
    lon: float = Query(...),
    date: str = Query(None),
    window_days: int = Query(WINDOW_DAYS_DEFAULT),
) -> JSONResponse:
    """MOCK del contrato §5. H1: tracks desde Horizons + métricas reales."""
    data = _mock("site.json")
    data["site"]["lat"] = lat
    data["site"]["lon"] = lon
    data["params"]["window_days"] = window_days
    data["params"]["comms_margin_deg"] = COMMS_MARGIN_DEFAULT_DEG
    return JSONResponse(data)


@app.get("/api/map")
def map_(metric: str = Query("illumination")) -> dict:
    """Placeholder del contrato §5. H1: sirve el raster/PNG precalculado."""
    return {"metric": metric, "status": "not-implemented-h0"}
