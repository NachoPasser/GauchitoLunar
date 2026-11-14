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

## Correr la API (mocks, estado H0)

```bash
cd backend
.venv/bin/uvicorn main:app --reload
# http://127.0.0.1:8000/docs
```

Endpoints (ver `api_contract.md`): `/api/mask`, `/api/site`, `/api/map`, `/api/sites`.
Hoy devuelven **mocks**; en H1 se reemplazan por cálculo real sin cambiar la forma.

## Archivos

| Archivo | Qué es |
|---|---|
| `main.py` | App FastAPI, sirve el contrato contra mocks |
| `constants.py` | Invariantes físicos §3.0 — **fuente única** |
| `sites.py` | Sitios semilla §4.5 |
| `ephem.py` | `ephem(site, t) → (az, el)` desde cache de Horizons |
| `fetch_horizons.py` | Baja y cachea az/el de Sol/Tierra |
| `fetch_data.sh` | Baja DEM + rasters a `../data/` |
| `gen_mocks.py` | Genera fixtures JSON del contrato |
| `mocks/` | `mask.json`, `site.json` (sintéticos) |
| `api_contract.md` | Contrato congelado §5 |
| `RESOURCES_NASA.md` | Revisión de la pestaña Resources del reto |
