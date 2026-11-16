# Lunar Landing Site Navigator

**NASA Space Apps Challenge 2026** — evaluate and compare lunar south pole landing sites based on solar energy potential and Earth communications visibility.

---

## 🚀 Live Demo

| URL | Status |
|-----|--------|
| **https://newspapers-surely-working-bridges.trycloudflare.com** | Primary (live now) |
| https://gauchitolunar-production.up.railway.app | Backup (cloud) |

---

## What it does

Pick a date range, explore the lunar south pole map, and click any site to get:

- **Skyline view** — terrain horizon mask + Sun and Earth tracks, showing when each body is visible or hidden behind ridges
- **Energy metrics** — integrated solar energy (kWh/m²), longest night duration
- **Comms metrics** — Earth visibility fraction, longest communications gap
- **Top 3 ranking** — best sites by energy, comms, or combined score

The physics engine uses real NASA DEM data (LOLA 80 m/px), JPL Horizons ephemerides, and PGDA illumination rasters. Results are validated against official NASA datasets.

---

## Key features

- Horizon mask computed by ray-casting over the DEM — once per site, cached
- Sun and Earth trajectories from JPL Horizons API (cached locally)
- Solar energy as a true integral `∫ S·sin(e)·V(t) dt`, not just % illuminated time
- Earth visibility uses a geometric line-of-sight condition with configurable margin
- Bilingual UI (ES / EN)

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python · FastAPI · rasterio · pyproj · numpy |
| Ephemeris | JPL Horizons API (disk-cached) |
| Data | LOLA DEM 80 m/px · PGDA illumination rasters |
| Frontend | Vanilla JS · HTML · CSS · SVG/Canvas |

---

## Team

Built in 48 h at NASA Space Apps Challenge 2026.

- [Ignacio Ucedo](https://www.linkedin.com/in/ignacio-ucedo-187a96361/)
- [Ignacio Passerini](https://www.linkedin.com/in/ignacio-passerini/?locale=en-US)
- [Jeremías Souto](https://www.linkedin.com/in/jeremias-souto-6b07752a5/)
