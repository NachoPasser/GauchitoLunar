"""FastAPI — API del contrato §5.

/api/mask y /api/site sirven cálculo REAL (máscara, tracks, métricas); /api/map
queda pendiente (H1.7). Las fixtures de mocks/ quedan como referencia del contrato.

Correr:  uvicorn main:app --reload   (desde backend/)
Docs:    http://127.0.0.1:8000/docs
"""

from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from constants import COMMS_MARGIN_DEFAULT_DEG, WINDOW_DAYS_DEFAULT
from sites import SEED_SITES

app = FastAPI(title="Lunar Landing Site Navigator", version="0.1-h1")

# El frontend vanilla corre desde file:// o un server estático aparte.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
def health() -> dict:
    return {"status": "ok", "service": "lunar-nav", "stage": "h1"}


@app.get("/api/sites")
def sites() -> dict:
    """Sitios semilla para poblar el mapa (no está en el contrato §5, utilitario)."""
    return {"sites": SEED_SITES}


@app.get("/api/mask")
def mask(lat: float = Query(...), lon: float = Query(...)) -> JSONResponse:
    """Máscara real h(az) por ray casting sobre el DEM (§3.3), cacheada por sitio."""
    from mask_service import get_mask
    return JSONResponse(get_mask(lat, lon))


@app.get("/api/site")
def site(
    lat: float = Query(...),
    lon: float = Query(...),
    date: str = Query(None),
    window_days: int = Query(WINDOW_DAYS_DEFAULT),
    comms_margin_deg: float = Query(COMMS_MARGIN_DEFAULT_DEG),
) -> JSONResponse:
    """Tracks Sol/Tierra desde Horizons + métricas reales (§3.1, §3.2, §5)."""
    from site_service import get_site
    return JSONResponse(get_site(lat, lon, date, window_days, comms_margin_deg))


@app.get("/api/map")
def map_(metric: str = Query("illumination")) -> dict:
    """Placeholder del contrato §5. H1: sirve el raster/PNG precalculado."""
    return {"metric": metric, "status": "not-implemented-h0"}
