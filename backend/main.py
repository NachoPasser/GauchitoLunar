"""FastAPI — API del contrato §5.

/api/mask y /api/site sirven cálculo REAL (máscara, tracks, métricas); /api/map
queda pendiente (H1.7). Las fixtures de mocks/ quedan como referencia del contrato.

Correr:  uvicorn main:app --reload   (desde backend/)
Docs:    http://127.0.0.1:8000/docs
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

from constants import COMMS_MARGIN_DEFAULT_DEG, WINDOW_DAYS_DEFAULT
from sites import SEED_SITES

app = FastAPI(title="Lunar Landing Site Navigator", version="0.1-h1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/map.html")


@app.get("/api/health")
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
    from ephem import EphemerisError
    from site_service import get_site
    try:
        return JSONResponse(get_site(lat, lon, date, window_days, comms_margin_deg))
    except EphemerisError as e:
        # Sitio libre sin cache y sin red para bajarlo. 503 (con CORS) → mensaje
        # legible en el frontend, no un 500 crudo que el browser ve como "Failed to fetch".
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/map")
def map_(metric: str = Query("illumination")) -> Response:
    """Fondo del mapa: raster PGDA precalculado como PNG (§4.1). Promedio, sin fecha."""
    from map_service import get_map_png
    try:
        png = get_map_png(metric)
    except KeyError:
        raise HTTPException(status_code=400,
                            detail="metric debe ser illumination|earth|psr")
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/map/meta")
def map_meta(metric: str = Query("illumination")) -> JSONResponse:
    """Geo-metadatos del fondo (bounds + proyección) para ubicar marcadores (H3)."""
    from map_service import get_map_meta
    try:
        return JSONResponse(get_map_meta(metric))
    except KeyError:
        raise HTTPException(status_code=400,
                            detail="metric debe ser illumination|earth|psr")


# Sirve el frontend como archivos estáticos — debe ir al FINAL para no
# interceptar las rutas /api/*.
_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if _FRONTEND.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND)), name="static")
