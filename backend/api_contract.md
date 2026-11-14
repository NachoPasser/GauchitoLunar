# Contrato de API — CONGELADO en H0 (SPEC §5)

> Esta es la frontera entre backend y frontend. **No se cambia sin avisar a los 3.**
> El frontend desarrolla contra `backend/mocks/*.json` (misma forma exacta).
> En H1 el backend reemplaza los mocks por cálculo real **sin cambiar la forma**.

## Convenciones (SPEC §3.0, fuente única: `constants.py`)

- Ángulos en **grados**. Azimut `0° = Norte`, horario hacia el Este (N→E→S→O).
- Tiempo en **UTC**, ISO-8601 (`2026-11-14T00:00:00+00:00`).
- Lat en grados (negativa = sur). Lon en grados este `[0, 360)`.

## `GET /api/mask?lat=&lon=`

Máscara de horizonte. Se calcula **una vez por sitio** y se cachea (no depende de la fecha).

```json
{
  "site": { "lat": -89.9, "lon": 0.0, "name": "Shackleton (borde)" },
  "horizon_mask": [ { "az": 0.0, "h_deg": 1.5 }, ... ]   // 360 (o 720) muestras
}
```

## `GET /api/site?lat=&lon=&date=&window_days=`

Tracks de Sol/Tierra + métricas. **Dependen de la fecha.** `window_days` default 30 (1 ciclo sinódico).

```json
{
  "site": { "lat": -89.9, "lon": 0.0, "name": "Shackleton (borde)" },
  "sun_track":   [ { "t": "...Z", "az": 0.0, "el": 1.5, "visible": true }, ... ],
  "earth_track": [ { "t": "...Z", "az": 10.0, "el": 0.3, "visible": false }, ... ],
  "metrics": {
    "energy_kwh_m2": { "horizontal": 0.0, "vertical_sun_tracking": 0.0 },
    "lit_fraction": 0.0,
    "longest_night_h": 92.0,
    "earth_vis_fraction": 0.0,
    "longest_comms_gap_h": 61.0,
    "next_sunset_h": 18.5,
    "next_earthset_h": 7.2
  },
  "params": { "comms_margin_deg": 0.0, "window_days": 30 }
}
```

- `visible`: Sol → `el > h(az)`. Tierra → `el > h(az) + comms_margin_deg`.
- Métricas integradas (`energy_*`, `longest_night_h`) solo representativas si
  `window_days ≥ 29.5`; con ventanas cortas, el frontend etiqueta "en la ventana elegida".

## `GET /api/map?metric=illumination|earth|psr`

Raster/tiles PNG precalculado (fondo del mapa). Promedios ~18.6 años, **NO dependen de la fecha**.

## Utilitario (fuera del §5)

`GET /api/sites` → `{ "sites": [ { "name", "lat", "lon", "note" }, ... ] }` (sitios semilla §4.5).
