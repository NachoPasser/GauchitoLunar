"""FastAPI — API del contrato §5.

/api/mask y /api/site sirven cálculo REAL (máscara, tracks, métricas); /api/map
queda pendiente (H1.7). Las fixtures de mocks/ quedan como referencia del contrato.

Correr:  uvicorn main:app --reload   (desde backend/)
Docs:    http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import logging
import math
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from constants import (COMMS_MARGIN_DEFAULT_DEG, COMMS_MARGIN_MAX_DEG,
                       COMMS_MARGIN_MIN_DEG, WINDOW_DAYS_DEFAULT)
from sites import SEED_SITES

log = logging.getLogger("lunar")

app = FastAPI(title="Lunar Landing Site Navigator", version="0.1-h1")

# Tope defensivo de la ventana: la UI manda como máximo 30 días; más de eso no aporta y un valor
# enorme dejaba el cálculo colgado minutos.
MAX_WINDOW_DAYS = 60
# El DEM (LDEM_80S) cubre de 80°S al polo. Fuera de eso no hay terreno para la máscara.
DEM_LAT_MAX = -80.0


async def _catch_all(request, call_next):
    """Convierte cualquier excepción no controlada en un 500 JSON legible. Se registra ANTES
    que CORS (queda por dentro): así CORS envuelve también estas respuestas y el navegador ve
    el error real en vez de un 'Failed to fetch' (un 500 crudo sale sin cabeceras CORS)."""
    try:
        return await call_next(request)
    except Exception:
        log.exception("Error no controlado en %s", request.url.path)
        return JSONResponse(
            {"detail": "Error interno del servidor al procesar el pedido."}, status_code=500)


def _check_site(lat: float, lon: float) -> None:
    """Valida coordenadas con un 422 legible (sin esto, fuera del DEM salía un 500 crudo)."""
    if not (math.isfinite(lat) and -90.0 <= lat <= DEM_LAT_MAX):
        raise HTTPException(
            status_code=422,
            detail=f"lat={lat} fuera de cobertura: el DEM cubre de -90° a {DEM_LAT_MAX}°.")
    if not (math.isfinite(lon) and -360.0 <= lon <= 360.0):
        raise HTTPException(status_code=422, detail="lon debe estar entre -360° y 360°.")


app.add_middleware(BaseHTTPMiddleware, dispatch=_catch_all)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/map.html")


# Datos IMPRESCINDIBLES para que la interfaz funcione: el DEM (máscara y relieve de fondo) y el
# raster de iluminación (fondo del mapa). earth/psr tienen endpoint pero la UI no los usa.
REQUIRED_RASTERS = ("illumination",)


@app.get("/api/health")
def api_health() -> dict:
    """¿Están los datos que la API necesita? El frontend lo consulta al arrancar para avisar
    'faltan datos' en vez de fallar pedido por pedido. ready=False solo si falta algo
    imprescindible (DEM o raster de iluminación). Lo opcional (rasters que la UI no usa,
    efemérides de un sitio semilla que se bajarían en vivo) se informa en warnings."""
    import ephem
    import geo
    import map_service

    missing, warnings = [], []
    if not geo.DEM_PATH.exists():
        missing.append("dem")
    for metric, fname in map_service.RASTERS.items():
        if not map_service._resolve_data_path(fname).exists():
            (missing if metric in REQUIRED_RASTERS else warnings).append(f"raster:{metric}")
    warnings += [f"horizons:{s['name']}" for s in SEED_SITES
                 if not ephem.has_cache(s["lat"], s["lon"], "sun")
                 or not ephem.has_cache(s["lat"], s["lon"], "earth")]
    # status/service/stage: liveness (lo usan el deploy/Docker); ready/missing/warnings: datos.
    return {"status": "ok", "service": "lunar-nav", "stage": "h1",
            "ready": not missing, "missing": missing, "warnings": warnings}


@app.get("/api/sites")
def sites() -> dict:
    """Sitios semilla para poblar el mapa (no está en el contrato §5, utilitario)."""
    return {"sites": SEED_SITES}


@app.get("/api/mask")
def mask(lat: float = Query(...), lon: float = Query(...)) -> JSONResponse:
    """Máscara real h(az) por ray casting sobre el DEM (§3.3), cacheada por sitio."""
    _check_site(lat, lon)
    from mask_service import get_mask
    return JSONResponse(get_mask(lat, lon))


@app.get("/api/site")
def site(
    lat: float = Query(...),
    lon: float = Query(...),
    date: str = Query(None),
    window_days: int = Query(WINDOW_DAYS_DEFAULT, ge=1, le=MAX_WINDOW_DAYS),
    comms_margin_deg: float = Query(COMMS_MARGIN_DEFAULT_DEG, ge=COMMS_MARGIN_MIN_DEG,
                                    le=COMMS_MARGIN_MAX_DEG),
) -> JSONResponse:
    """Tracks Sol/Tierra desde Horizons + métricas reales (§3.1, §3.2, §5)."""
    _check_site(lat, lon)
    if date is not None:
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=422, detail=f"date inválida: '{date}' (se espera YYYY-MM-DD).")
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
