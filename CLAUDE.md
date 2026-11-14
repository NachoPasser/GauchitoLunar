# CLAUDE.md — Guía de trabajo del repo

> **Lunar Landing Site Navigator** — NASA Space Apps Challenge 2026.
> Hackathon 14–15 nov 2026, 48 h. Equipo de 3.
> La fuente de verdad del producto es **`lunar-landing-site-navigator-SPEC.md`**. Este archivo es
> solo el resumen operativo para desarrollar; ante cualquier duda de alcance, manda el SPEC.

## Qué es

Web **simple e intuitiva** para evaluar y comparar sitios de aterrizaje en el **polo sur lunar**:
posición de Sol y Tierra respecto al horizonte local en un sitio y fecha, para estimar **energía
solar** (generación) y **comunicación directa con la Tierra** (línea de vista).

**Tesis:** ganamos por **rigor físico** (validado contra datos NASA), pero esa física se **traduce**
a una UI legible por cualquier persona casual. No es el simulador más preciso; es el que resuelve
bien riesgos físicos que otros ignoran y los muestra entendibles.

**Usuario a optimizar: persona casual sin conocimiento de dominio.** Debe entender en ~30 s sin leer
instrucciones. Lenguaje llano primero, jerga (azimut, elevación, libración) solo como etiqueta
secundaria. El marco "ingeniero/planificador" es narrativa de credibilidad ante el jurado, **no** un
usuario para el que diseñemos pantallas.

## Stack

- **Backend:** Python, FastAPI, `rasterio`, `pyproj`, `numpy`, `httpx`/`requests` (Horizons).
- **Frontend:** HTML + CSS + JS **vanilla**, SVG/canvas. **Sin 3D.** Hoy usa Tailwind por CDN.
- **Datos (self-host, no depender de la red del venue):** DEM polar LOLA (PGDA), rasters de
  iluminación PGDA (producto 69), cache de efemérides **JPL Horizons** en disco.

## Invariantes físicos — fijar una vez, respetar en TODO el código

> El bug más caro del proyecto es mezclar convenciones de ángulo. Cuidado acá.

- **Azimut:** `0° = Norte`, horario hacia el Este (N→E→S→O). Mismo cero y mismo sentido en máscara
  `h(az)`, tracks de Sol/Tierra, cono del mapa y ventana del skyline.
- **Marco espacial:** ENU local (East-North-Up) del sitio, derivado de MOON_ME.
- **Tiempo:** todo en **UTC**. Un único reloj en backend y UI.
- **Ángulos:** grados en API y UI; radianes solo internos.
- **CRS mapa/DEM:** estereográfica polar sur, esfera `R = 1737.4 km`. Leer meridiano/paralelo de los
  metadatos del raster con `rasterio`, reusar en `pyproj`. No asumirlos.
- **La máscara `h(az)` se calcula en el BACKEND, una vez por sitio (no depende de la fecha). El
  frontend solo dibuja.**
- Energía = **integral** `E_total = ∫ S·max(0, sin e)·V(t) dt` (kWh/m²), no % de tiempo iluminado.
- Comms = condición "cliff": `elevación_Tierra > h(az_Tierra) + margen`. Default `margen = 0`
  (geométrico, reproducible), slider 0°–1°. Mostrar siempre el valor usado.

## Reglas de desarrollo (modo de trabajo)

- **Tareas atómicas ≤ ~150 líneas.** Si algo es más grande, implementá solo la primera pieza lógica
  y pará.
- **Máx. 100 caracteres por línea** en código (JS, etc.).
- **Plan antes de código:** ante un requerimiento complejo, presentá primero una checklist de pasos
  atómicos y **esperá confirmación** antes de tocar código.
- **Prohibido boilerplate asumido:** no reescribir archivos enteros salvo que sea estrictamente
  necesario. Modificar solo las funciones/bloques pedidos.
- **Respetar contratos:** si una interfaz/tipo ya existe (ver contrato de API abajo), usala; no
  inventar estructuras paralelas ni duplicar lógica.
- **TDD en el núcleo físico** (máscara, integración de energía, az/el, condición de visibilidad):
  ahí la correctitud es el diferenciador y se valida contra Horizons. En UI/plumbing, tests
  livianos para no frenar en 48 h.
- **Estética:** simple e intuitiva siempre. Prioridad = fácil de entender y usar.
- Al implementar código nuevo, **explicar brevemente qué se hizo**.
- Encapular Horizons detrás de `ephem(site, t) → (az, el)` para no atar el resto del código.

## Contrato de API (borrador — respetar)

```
GET /api/mask?lat=&lon=
→ { site:{lat,lon,name}, horizon_mask:[{az,h_deg},...] }   # 360/720 muestras, cache por sitio

GET /api/site?lat=&lon=&date=&window_days=                  # window_days default ~30 (1 ciclo sinódico)
→ { site:{lat,lon,name},
    sun_track:[{t,az,el,visible},...], earth_track:[{t,az,el,visible},...],
    metrics:{ energy_kwh_m2:{horizontal,vertical_sun_tracking},
              lit_fraction, longest_night_h, earth_vis_fraction, longest_comms_gap_h,
              next_sunset_h, next_earthset_h },
    params:{ comms_margin_deg, window_days } }

GET /api/map?metric=illumination|earth|psr                  # raster/tiles PNG precalculado
```

Métricas integradas (energía, longest_night) solo son representativas con `window_days ≥ 1` ciclo
(~29.5 d); con ventanas cortas, etiquetar "en la ventana elegida".

## Flujo / vistas del frontend

- **A. Bienvenida:** mini-tutorial (2 líneas) + date-range picker del rango global. Enter → mapa.
- **B. Mapa polar (hub):** fondo = raster de iluminación. ⭐ sitios predefinidos, 📍 chinchetas del
  usuario. Click en marcador → detalle (modal); click en zona libre → botón flotante (agregar 📍 /
  ver detalle).
- **C. Top 3 (modal):** carrusel de 3 pasos (comms / energía / mixto) + tabla de ranking de todos
  los sitios; tarjetas y filas con "ver detalle".
- **D. Detalle puntual (modal sobre el mapa):** **skyline** (x = azimut 0–360°, y = elevación) con
  silueta `h(az)`, tracks de Sol y Tierra (brillante = visible / apagado = tapado), cuenta regresiva
  a ocaso/Earthset, margen de comms punteado + panel de métricas.
- **Estado compartido (única fuente de verdad):** `{ rangoFechas, sitios[], sitioActivo, ventanaAzimut }`.

Vista por defecto del cielo: **skyline** (más legible que la cenital para un casual).

## Orden de construcción (prioridades 48 h)

1. Backend máscara + trayectorias (Horizons + DEM 80 m) — pieza central.
2. Detalle puntual: skyline + métricas con slider de tiempo.
3. Mapa polar hub + sitios predefinidos + click + orientación.
4. Bienvenida + date-range + wiring del estado compartido.
5. Top 3: carrusel + ranking + semáforos.
6. Extra: cono/sincronización por azimut, Monte Carlo de dispersión, eclipses, modo guiado, export.

**Línea de corte MVP:** máscara por sitio + tracks Sol/Tierra + detalle puntual legible con cuenta
regresiva + mapa hub (predefinidos + agregar propios) + Top 3 con ranking. El resto es mejora.
Regla: primero que el **skyline se entienda solo**; no agregar features si la base no es legible.

## Estado actual del repo

- **Backend (`backend/`): H0 y H1 cerrados.** FastAPI con los 3 endpoints del contrato §5
  (`/api/mask`, `/api/site`, `/api/map`) sirviendo datos reales: máscara `h(az)` por ray casting
  sobre el DEM, tracks Sol/Tierra desde Horizons, energía integrada + métricas + cartuchos
  (`sun_intervals`/`earth_intervals`). Núcleo físico con tests (pytest). Datos pesados en `data/`
  (DEM + rasters PGDA + cache de Horizons), fuera del repo.
- **Frontend (`frontend/`): H2 en curso.** Vanilla. El viejo cascarón de intro en 3 pasos sigue
  en `index.html`/`script.js`/`styles.css` para reusar piezas (date-range en H4). La vista nueva de
  detalle vive en `detail.html` + `detail.js` + `skyline.js` + `api.js` (skyline con terreno, tracks,
  margen de comms y banda de azimut). Falta: slider de tiempo, panel de métricas y cartuchos.
- Lo que contradiga la arquitectura del SPEC se adapta o se descarta.

## Honestidad (para no prometer de más)

- Rasters de iluminación = promedios ~18.6 años, NO dependen de la fecha (capa base del mapa, no el
  detalle temporal).
- Resolución del DEM limita la precisión de sombras. No prometer modelo térmico.
- Márgenes (Fresnel, comms) = órdenes de magnitud, parametrizables, no del brief. Mostrar el valor.
- Validar números contra rasters oficiales antes de afirmarlos en la presentación.
- **Revisar la pestaña Resources del reto** por si la NASA apunta a un dataset/API específico.
