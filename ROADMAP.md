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

- [x] Estructura de carpetas: `backend/` (FastAPI) y `frontend/` (el vanilla actual).
- [x] `backend/`: entorno Python (venv/requirements), FastAPI "hola mundo" que levanta.
- [x] Definir `backend/constants.py` con los invariantes físicos del §3.0/§3 (S=1361, R=1737.4,
      convención de azimut, etc.) — **una sola fuente**.
- [x] Bajar y cachear datos en `data/` (NO al repo si pesan; `.gitignore`):
  - [x] DEM polar `LDEM_80S_80MPP_ADJ.TIF` (80 m, 181 MB).
  - [x] Raster iluminación `AVGVISIB_85S_060M_201608.TIF` + Earth + PSR.
- [x] **Cache de Horizons:** script que baja az/el de Sol y Tierra para un sitio semilla y un rango,
      y lo guarda en disco (JSON/parquet). **Pre-generar ya** por si Horizons no responde en el venue.
- [x] Encapsular en `ephem(site, t) → (az, el)` (firma, aunque devuelva del cache).
- [x] **Congelar el contrato de API** (§5 del SPEC) en un archivo o docstring + **fixtures/mocks
      JSON** de `/api/mask` y `/api/site` para que el frontend arranque sin backend real.
- [x] Revisar la pestaña **Resources** del reto (dataset/API que la NASA pueda pedir).
      Ver `backend/RESOURCES_NASA.md` (ojo: el reto cita `LDEM_85S_20M` y DE441).

**DoD:** FastAPI levanta, datos en disco, cache de Horizons generado, mocks JSON del contrato
disponibles. A partir de acá los 3 pueden trabajar en paralelo.

---

## H1 — Núcleo físico backend (ruta crítica) · `feat/h1-*`

**Objetivo:** la pieza central. Máscara + tracks + métricas servidos como JSON. **TDD acá.**
**Depende de:** H0.

- [x] Abrir DEM con `rasterio`, recortar ventana alrededor de un sitio (lat/lon → píxel con `pyproj`).
- [x] **Máscara `h(az)`**: ray casting sobre el raster, elevación `atan2(Δz_corregido, s)` con
      curvatura lunar `Δz_corr = Δz − s²/(2R)`. Guardar array 360/720. **Test** de sanity.
- [x] `GET /api/mask?lat=&lon=` devuelve `horizon_mask` según contrato (cache por sitio).
- [x] Tracks Sol/Tierra desde el cache de Horizons para el rango; marcar `visible` con la condición
      `el_Tierra > h(az) + margen` y `el_Sol > h(az)`. **Test** (Tierra pegada al horizonte en el polo).
- [x] **Energía integrada** `E_total = ∫ S·max(0,sin e)·V dt` (horizontal y vertical sun-tracking).
      **Test** de la integración numérica.
- [x] Métricas: `lit_fraction`, `longest_night_h`, `earth_vis_fraction`, `longest_comms_gap_h`,
      `next_sunset_h`, `next_earthset_h`.
- [x] **Cartuchos** (§3.1): `sun_intervals`/`earth_intervals` = tramos contiguos de estado
      (lit/dark, visible/hidden) derivados de los tracks, para la vista de detalle. **Test** de
      consistencia con `longest_night_h`/`longest_comms_gap_h`.
- [x] `GET /api/site?lat=&lon=&date=&window_days=` arma la respuesta completa del contrato.
- [x] `GET /api/map?metric=illumination|earth|psr` sirve el raster/PNG precalculado.
- [x] Cargar los **sitios semilla** (§4.5) para tener contenido de demo.

**DoD:** los 3 endpoints responden con datos reales y coherentes; tests del núcleo físico pasan.

---

## H2 — Detalle puntual / Skyline (frontend) · `feat/h2-skyline`

**Objetivo:** vista más importante para el jurado. Cumple el requisito de horizonte por sí sola.
**Depende de:** contrato H0 (arranca contra mock; conecta a H1 cuando esté).

- [x] Modal de detalle puntual sobre el mapa (estructura + abrir/cerrar).
- [x] **Skyline** SVG/canvas: eje x = azimut 0–360°, eje y = elevación. Silueta del terreno `h(az)`.
- [x] Trayectorias de Sol y Tierra: **brillante = visible / apagado = tapado**, tramo tapado
      punteado, label "tapado por el terreno".
- [x] Margen de comms punteado + ventana de azimut (banda).
- [x] Rango vertical dinámico (piso ~5°) + botón "cielo completo" (0–90°).
- [x] Slider de tiempo que mueve Sol/Tierra sobre el skyline.
- [x] Panel de métricas en **lenguaje llano** (potencia/comms).
- [x] Cuenta regresiva a ocaso ("sunset") y "Earthset".
- [x] Cartuchos de tiempo (días con/sin iluminación; con/sin visibilidad a Tierra).

**DoD:** el skyline se entiende solo, sin explicación; conecta a `/api/site`. ✅

> H2 implementado en `frontend/`: `detail.html` (harness/modal) + `detail.js` + `skyline.js`
> (SVG reusable) + `panel.js` (métricas + cartuchos) + `api.js`. Verificado con captura real
> (Chrome headless) contra el backend. H3 montará este mismo skyline/panel como modal del mapa.

---

## H3 — Mapa polar hub (frontend) · `feat/h3-map`

**Objetivo:** pantalla de descubrimiento ("¿dónde miro?").
**Depende de:** contrato H0 (mock del raster) + H2 para el "ver detalle".

- [x] Canvas/PNG de fondo = raster de iluminación (`/api/map`).
- [x] ⭐ sitios predefinidos (semilla) dibujados sobre el mapa.
- [x] Click en marcador → abre detalle (modal de H2).
- [x] Click en zona libre → botón flotante: (1) agregar 📍 a `sitios[]`, (2) ver detalle puntual.
- [x] Orientación: inset de globo, anillos de latitud, barra de escala (100 km), subtítulo.
      **Nota honestidad:** el raster de fondo (85°S/060M) mide ~303 km de lado y llega a
      ~83°S en las esquinas, NO "80°S–90°S · ~600 km". Anillos reales dibujados = 85°S y
      88°S (80°S queda fuera del lienzo). Subtítulo corregido a "~83°S–90°S · ~300 km".
- [x] Flechas de Sol/Tierra en el margen (DIRECCIÓN, no visibilidad). Usan el azimut de un
      sitio de referencia cerca del polo en UN instante (inicio de ventana), rotulado.

**DoD:** se ven todos los sitios, se puede abrir detalle y agregar sitios propios. ✅

> H3 en `frontend/`: `map.html` + `map.js` (fondo, marcadores proyectados, chrome,
> flechas, popup de zona libre) + `proj.js` (estereográfica polar sur, validada al metro
> contra pyproj) + `detailModal.js` (showSite compartido con H2). Backend: `/api/map/meta`
> expone bounds + proyección leídos del CRS del raster. Verificado headless (Chrome).
> Pendiente para H4: cablear `sitios[]`/`sitioActivo` al estado compartido (hoy las
> chinchetas 📍 son locales de la página).

---

## H4 — Bienvenida + estado compartido (frontend) · `feat/h4-state`

**Objetivo:** fijar el rango global y cablear la única fuente de verdad.
**Depende de:** contrato H0. (Reutiliza el cascarón de bienvenida ya existente en `index.html`.)

- [x] Pantalla de bienvenida: mini-tutorial + **date-range picker** del rango global
      (se reusó el cascarón de 3 pasos de `index.html`, ya tenía el picker con límite 30 d).
- [x] Enter/confirmar → fija `rangoFechas` → `window_days` → navega al mapa (`map.html`,
      preservando `?api=`). El submit válido persiste el rango y redirige.
- [x] **Estado compartido** `{ rangoFechas, sitios[], sitioActivo, ventanaAzimut }` en
      `state.js` como única fuente de verdad; cruza páginas por `localStorage` y notifica
      en página con `subscribe()`. `ventanaAzimut` reservado para H6.
- [x] Adaptar lo del frontend actual: `index.html` es ahora la bienvenida real (su submit
      navega al mapa en vez de solo mostrar telemetría).

**DoD:** el rango elegido se propaga a todas las vistas; agregar/abrir sitios actualiza el
estado. ✅ Verificado headless: rango sembrado → flechas Sol/Tierra y modal usan `windowDays`
+ `startDate`; chinchetas 📍 persistidas reaparecen en el mapa.

> H4 en `frontend/`: `state.js` (store + localStorage + bridge `window.LLNState` para el
> `script.js` clásico). `index.html`/`script.js` navegan al mapa con el rango fijado.
> `map.js` lee `state`: carga 📍 persistidas, setea `sitioActivo` al abrir detalle, y pasa
> `windowDays`/`startDate` al modal y a las flechas. Pendiente H5: el ranking consumirá
> `sitios[]` (semillas + propios) del estado.

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
