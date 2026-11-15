# Backend — Lunar Landing Site Navigator

FastAPI + núcleo físico. Fuente de verdad del producto: `../lunar-landing-site-navigator-SPEC.md`.
Contrato de API congelado: `api_contract.md`. Invariantes físicos: `constants.py` (fuente única).

## Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Datos (no van al repo, ver ../.gitignore)

```bash
bash fetch_data.sh                 # DEM 80 m + rasters de iluminación → ../data/
.venv/bin/python fetch_horizons.py # cache de Sol/Tierra → ../data/horizons/
.venv/bin/python gen_mocks.py      # regenera fixtures mocks/*.json (sintéticas)
```

`fetch_horizons.py` opciones: `--start YYYY-MM-DD --days N --step 20m`.

## Correr la API

```bash
cd backend
.venv/bin/uvicorn main:app --reload
# http://127.0.0.1:8000/docs
```

Endpoints (ver `api_contract.md`): `/api/mask`, `/api/site`, `/api/map`, `/api/map/meta`, `/api/sites`.
Sirven **datos reales** (H0 y H1 cerrados): máscara por ray casting sobre el DEM, tracks desde el
cache de Horizons, energía + métricas. Los `mocks/*.json` quedan como **fixtures de referencia** del
contrato. Sitios libres (no semilla): si no hay cache, `/api/site` baja de Horizons en vivo on-miss
(503 con CORS legible si no hay red).

## Archivos

| Archivo | Qué es |
|---|---|
| `main.py` | App FastAPI, endpoints del contrato §5 |
| `constants.py` | Invariantes físicos §3.0 — **fuente única** |
| `sites.py` | Sitios semilla §4.5 |
| `ephem.py` | `ephem(site, t) → (az, el)` desde cache de Horizons |
| `geo.py` | DEM: CRS/transform de metadatos, lon/lat→px, dirs N/E locales |
| `mask.py` | Ray casting de `h(az)` con curvatura lunar |
| `mask_service.py` | `/api/mask`: máscara por sitio + cache (`../data/mask_cache/`) |
| `tracks.py` | Tracks Sol/Tierra + condición de visibilidad |
| `metrics.py` | Energía integrada + métricas del contrato |
| `site_service.py` | `/api/site`: ensambla tracks + métricas |
| `map_service.py` | `/api/map`: rasters PGDA → PNG (`../data/map_png/`) |
| `fetch_horizons.py` | Baja y cachea az/el de Sol/Tierra |
| `fetch_data.sh` | Baja DEM + rasters a `../data/` |
| `gen_mocks.py` | Genera fixtures JSON del contrato (referencia) |
| `mocks/` | `mask.json`, `site.json` (sintéticos, referencia del contrato) |
| `tests/` | TDD del núcleo físico (máscara, tracks, energía, métricas, mapa) |
| `api_contract.md` | Contrato congelado §5 |
| `RESOURCES_NASA.md` | Revisión de la pestaña Resources del reto |

Tests: `.venv/bin/python -m pytest -q` (los que tocan datos se saltan si falta el DEM/rasters).
