# ROADMAP — Lunar Landing Site Navigator

> Plan de construcción por **hitos/bloques** para 48 h, equipo de 3.
> Fuente de verdad del producto: `lunar-landing-site-navigator-SPEC.md`. Reglas de trabajo: `CLAUDE.md`.
> Orden derivado del §7 del SPEC. Cada tarea es **atómica (≤ ~150 líneas)**; si crece, cortar.

## Cómo usar este documento

- Marcá `[x]` al cerrar cada tarea. Cada hito tiene un **DoD** (Definition of Done) y sus
  **dependencias**.
- **Arrancamos H0 juntos** (fundaciones + congelar el contrato de API). Recién cuando el contrato
  está fijo nos **dividimos en branches** y el frontend trabaja contra **mocks** sin esperar al
  backend.
- Convención de ramas: `feat/<hito>-<tema>` (p. ej. `feat/h1-mask`, `feat/h2-skyline`). PRs chicos
  contra `main`. No tocar `script.js`/`index.html` desde dos ramas a la vez sin avisar.

## Mapa de dependencias (ruta crítica)

```
H0 (grupo) ──▶ congela contrato API + conventions
   ├──▶ H1 Backend físico (ruta crítica)
   ├──▶ H2 Skyline/detalle   ─┐ (contra mock del contrato)
   ├──▶ H3 Mapa polar hub     │ convergen en H5
   └──▶ H4 Bienvenida+estado ─┘
                 H5 Top 3 (necesita métricas de varios sitios) ──▶ H6 extras
```

**Línea de corte MVP** (lo que SÍ debe andar en la demo): H1 + H2 + H3 + H4 + H5.
H6 es mejora. Regla de oro: **primero que el skyline se entienda solo.**

---

## H0 — Fundaciones (GRUPO, antes de dividirnos)

**Objetivo:** esqueleto del repo, datos bajados y contrato congelado para desbloquear a los 3.

- [ ] Estructura de carpetas: `backend/` (FastAPI) y `frontend/` (el vanilla actual).
- [ ] `backend/`: entorno Python (venv/requirements), FastAPI "hola mundo" que levanta.
- [ ] Definir `backend/constants.py` con los invariantes físicos del §3.0/§3 (S=1361, R=1737.4,
      convención de azimut, etc.) — **una sola fuente**.
- [ ] Bajar y cachear datos en `data/` (NO al repo si pesan; `.gitignore`):
  - [ ] DEM polar `LDEM_80S_80MPP_ADJ.TIF` (80 m, 181 MB).
  - [ ] Raster iluminación `AVGVISIB_85S_060M_201608.TIF` + Earth + PSR.
- [ ] **Cache de Horizons:** script que baja az/el de Sol y Tierra para un sitio semilla y un rango,
      y lo guarda en disco (JSON/parquet). **Pre-generar ya** por si Horizons no responde en el venue.
- [ ] Encapsular en `ephem(site, t) → (az, el)` (firma, aunque devuelva del cache).
- [ ] **Congelar el contrato de API** (§5 del SPEC) en un archivo o docstring + **fixtures/mocks
      JSON** de `/api/mask` y `/api/site` para que el frontend arranque sin backend real.
- [ ] Revisar la pestaña **Resources** del reto (dataset/API que la NASA pueda pedir).

**DoD:** FastAPI levanta, datos en disco, cache de Horizons generado, mocks JSON del contrato
disponibles. A partir de acá los 3 pueden trabajar en paralelo.

---

## H1 — Núcleo físico backend (ruta crítica) · `feat/h1-*`

**Objetivo:** la pieza central. Máscara + tracks + métricas servidos como JSON. **TDD acá.**
**Depende de:** H0.

- [ ] Abrir DEM con `rasterio`, recortar ventana alrededor de un sitio (lat/lon → píxel con `pyproj`).
- [ ] **Máscara `h(az)`**: ray casting sobre el raster, elevación `atan2(Δz_corregido, s)` con
      curvatura lunar `Δz_corr = Δz − s²/(2R)`. Guardar array 360/720. **Test** de sanity.
- [ ] `GET /api/mask?lat=&lon=` devuelve `horizon_mask` según contrato (cache por sitio).
- [ ] Tracks Sol/Tierra desde el cache de Horizons para el rango; marcar `visible` con la condición
      `el_Tierra > h(az) + margen` y `el_Sol > h(az)`. **Test** (Tierra pegada al horizonte en el polo).
- [ ] **Energía integrada** `E_total = ∫ S·max(0,sin e)·V dt` (horizontal y vertical sun-tracking).
      **Test** de la integración numérica.
- [ ] Métricas: `lit_fraction`, `longest_night_h`, `earth_vis_fraction`, `longest_comms_gap_h`,
      `next_sunset_h`, `next_earthset_h`.
- [ ] `GET /api/site?lat=&lon=&date=&window_days=` arma la respuesta completa del contrato.
- [ ] `GET /api/map?metric=illumination|earth|psr` sirve el raster/PNG precalculado.
- [ ] Cargar los **sitios semilla** (§4.5) para tener contenido de demo.

**DoD:** los 3 endpoints responden con datos reales y coherentes; tests del núcleo físico pasan.

---

## H2 — Detalle puntual / Skyline (frontend) · `feat/h2-skyline`

**Objetivo:** vista más importante para el jurado. Cumple el requisito de horizonte por sí sola.
**Depende de:** contrato H0 (arranca contra mock; conecta a H1 cuando esté).

- [ ] Modal de detalle puntual sobre el mapa (estructura + abrir/cerrar).
- [ ] **Skyline** SVG/canvas: eje x = azimut 0–360°, eje y = elevación. Silueta del terreno `h(az)`.
- [ ] Trayectorias de Sol y Tierra: **brillante = visible / apagado = tapado**, tramo tapado
      punteado, label "blocked by terrain".
- [ ] Margen de comms punteado + ventana de azimut (banda).
- [ ] Rango vertical dinámico (piso ~5°) + botón "cielo completo" (0–90°).
- [ ] Slider de tiempo que mueve Sol/Tierra sobre el skyline.
- [ ] Panel de métricas en **lenguaje llano** + **semáforos** potencia/comms.
- [ ] Cuenta regresiva a ocaso ("sunset") y "Earthset".
- [ ] Cartuchos de tiempo (días con/sin iluminación; con/sin visibilidad a Tierra).

**DoD:** el skyline se entiende solo, sin explicación; conecta a `/api/site`.

---

## H3 — Mapa polar hub (frontend) · `feat/h3-map`

**Objetivo:** pantalla de descubrimiento ("¿dónde miro?").
**Depende de:** contrato H0 (mock del raster) + H2 para el "ver detalle".

- [ ] Canvas/PNG de fondo = raster de iluminación (`/api/map`).
- [ ] ⭐ sitios predefinidos (semilla) dibujados sobre el mapa.
- [ ] Click en marcador → abre detalle (modal de H2).
- [ ] Click en zona libre → botón flotante: (1) agregar 📍 a `sitios[]`, (2) ver detalle puntual.
- [ ] Orientación: inset de globo, anillos de latitud (80/85/90°S), barra de escala (100 km),
      subtítulo "80°S–90°S · ~600 km".
- [ ] Flechas de Sol/Tierra en el margen (DIRECCIÓN, no visibilidad).

**DoD:** se ven todos los sitios, se puede abrir detalle y agregar sitios propios.

---

## H4 — Bienvenida + estado compartido (frontend) · `feat/h4-state`

**Objetivo:** fijar el rango global y cablear la única fuente de verdad.
**Depende de:** contrato H0. (Reutiliza el cascarón de bienvenida ya existente en `index.html`.)

- [ ] Pantalla de bienvenida: mini-tutorial (2 líneas) + **date-range picker** del rango global.
- [ ] Enter/confirmar → fija `rangoFechas` → `window_days` → navega al mapa.
- [ ] **Estado compartido** `{ rangoFechas, sitios[], sitioActivo, ventanaAzimut }` como única
      fuente de verdad, consumido por mapa / detalle / Top 3.
- [ ] Adaptar/descartar lo del frontend actual que contradiga esta arquitectura.

**DoD:** el rango elegido se propaga a todas las vistas; agregar/abrir sitios actualiza el estado.

---

## H5 — Top 3 / Ranking (frontend) · `feat/h5-top3` — CONVERGENCIA

**Objetivo:** comparación rápida entre sitios. Cierra el MVP.
**Depende de:** H1 (métricas por sitio), H3/H4 (sitios en el estado).

- [ ] Modal con **carrusel de 3 pasos**: (1) comms, (2) energía, (3) mixto.
- [ ] Por paso: 3 tarjetas top + tabla de ranking de **todos** los sitios seleccionados.
- [ ] Criterio **mixto**: normalizar cada métrica 0–1 sobre los sitios, combinar (default 50/50,
      slider opcional). **Mostrar el peso usado** (honestidad).
- [ ] Botón "ver detalle" en cada tarjeta y fila → abre el skyline de H2.

**DoD:** se puede rankear por los 3 criterios y saltar al detalle de cualquier sitio. **== MVP listo.**

---

## H6 — Extras (solo si sobra tiempo)

**Depende de:** MVP. Priorizar en este orden, cada uno independiente:

- [ ] Cono/sincronización por azimut mapa↔skyline (§2.3).
- [ ] Monte Carlo de dispersión del aterrizaje (probabilidad sobre la elipse de error).
- [ ] Eclipses de Sol por la Tierra vistos desde la Luna.
- [ ] Disco solar finito / penumbra en la energía.
- [ ] Modo guiado / exportar / compartir.
- [ ] Validación de fracciones integradas contra rasters PGDA (caro, §4.4).

---

## Reparto sugerido (3 personas, tras H0)

| Persona | Hitos | Rama(s) |
|---|---|---|
| **A — Backend/física** | H1 (+ apoyo H5 métricas) | `feat/h1-*` |
| **B — Frontend detalle** | H2 skyline (+ H6 extras visuales) | `feat/h2-skyline` |
| **C — Frontend mapa/estado** | H3 + H4 (+ H5 UI ranking) | `feat/h3-map`, `feat/h4-state` |

H5 es punto de **convergencia**: A entrega métricas, C arma la UI del ranking, B provee el salto al
detalle. Integrar temprano y seguido para no chocar en `script.js`/`index.html`.
