# Lunar Landing Site Navigator — Spec de trabajo

> Documento de contexto para desarrollar en Claude Code.
> NASA Space Apps Challenge 2026 — reto "Lunar Landing Site Navigator".
> Fecha del hackathon: 14–15 nov 2026. 48 h.

---

## 1. Qué construimos

Una herramienta web **intuitiva y simple** para evaluar y comparar sitios de aterrizaje en el **polo sur lunar**, mostrando posición del Sol y de la Tierra respecto al horizonte local en un sitio y fecha, para estimar **potencia** (generación solar) y **comunicación directa con la Tierra**.

**Tesis de diferenciación:** destacar por **rigor físico**. No el simulador más preciso, sino el que resuelve bien riesgos físicos que otros ignoran, y que muestra esa física en la interfaz **de forma legible para cualquiera** (no escondida en el código, pero tampoco en crudo). El rigor es también la narrativa ante el jurado: validar contra datos publicados de la NASA.

Lo que el brief pide como núcleo (obligatorio de facto):
- Visualizar Sol y Tierra respecto al horizonte en un sitio + fecha.
- Tiempo restante hasta el ocaso ("sunset") y hasta el "Earthset".
- Comparar sitios y fechas rápido.
- Métricas: elevación solar, duración de luz, ventanas de visibilidad de la Tierra.

Lo que el brief marcaba como opcional ("you may"): mapas 2D, vistas 3D, animaciones, juego educativo. El 3D NO es obligatorio.

### 1.1 Usuario objetivo

**Primario y único a optimizar: una persona casual, sin conocimiento de dominio.** Cualquiera que entre debe poder usarla sin leer instrucciones: curiosos, visitantes del stand, estudiantes, el propio jurado. NO asumimos que sepan qué es azimut, elevación solar, libración ni línea de vista.

Consecuencias de diseño (atan al resto del doc):
- **Lenguaje llano en la UI**, jerga solo como etiqueta secundaria: "cuánta luz de sol recibe" antes que "irradiancia integrada"; "¿se puede hablar con la Tierra?" antes que "ventana de visibilidad".
- **Cero configuración obligatoria:** defaults sensatos (margen de comms, rango de fechas). Los parámetros finos (slider de margen, superficie del panel) van como "ver más", no en el camino principal.
- **Entender en ~30 s:** semáforos, rankings y comparaciones visuales antes que tablas densas.
- **El rigor no se sacrifica, se traduce:** la física correcta sigue por debajo; la UI la muestra *legible* (visual, con explicación a un clic), no escondida pero tampoco impuesta. Así se resuelve la tensión con la tesis: "mostrar la física" = mostrarla entendible, no en bruto.

El marco "planificador de misión / ingeniero" es **narrativa de credibilidad** ante el jurado (por qué esto importa), NO un usuario real de la interfaz. No diseñamos pantallas para expertos.

---

## 2. Flujo de usuario y arquitectura de vistas

### 2.1 Flujo (pantallas)

**Estado compartido (única fuente de verdad):** `{ rangoFechas, sitios[], sitioActivo, ventanaAzimut }`.
- `rangoFechas`: global, se fija al inicio → determina `window_days` (§5).
- `sitios[]`: predefinidos (famosos, ⭐) + propios del usuario (chinchetas 📍). **Todos** entran al ranking.
- `sitioActivo`: el sitio cuyo detalle está abierto.

**A. Bienvenida.** Texto corto de bienvenida / mini-tutorial (qué es y cómo se usa, en 2 líneas) + un campo para el **rango de fechas a analizar** (idealmente un date-range picker: más amigable para un casual que texto libre). Enter → mapa.

**B. Mapa (hub).** Al entrar muestra **todos los sitios predefinidos** con una ⭐. Interacción:
- **Click en un marcador existente** (⭐ o 📍) → abre su **detalle puntual** (modal).
- **Click en zona libre del mapa** → aparece un **botón flotante** con dos opciones: (1) **agregar como sitio propio** (fija una chincheta 📍 y lo suma a `sitios[]`), (2) **ver detalle puntual** de ese punto.

**C. Top 3.** Un botón abre un **carrusel de 3 pasos**, uno por criterio:
1. **Comunicación con la Tierra** (fracción de tiempo visible / menor corte continuo).
2. **Energía solar** (kWh/m² integrados).
3. **Mixto** (combinación normalizada de los dos; ver nota).

Cada parada muestra las **3 mejores tarjetas** (top 3 de `sitios[]` para ese criterio) y debajo una **tabla de ranking** tipo tabla de posiciones con todos los sitios seleccionados. Cada tarjeta y cada fila tienen un botón **"ver detalle"**.

> **Criterio "mixto":** no es obvio, hay que definirlo explícito. Propuesta: normalizar cada métrica a 0–1 sobre los sitios seleccionados y combinar con pesos (default 50/50, slider opcional). Mostrar el peso usado (honestidad, §8).

**D. Modals sobre el mapa.** Tanto el **Top 3** como el **detalle puntual** se abren como **modal encima del mapa** (el mapa queda de fondo; no se navega fuera de él).

### 2.2 Las dos vistas detrás del flujo

| Vista | Dónde aparece | Pregunta que responde | Rol |
|---|---|---|---|
| **South pole map** (mapa polar 2D) | Pantalla B (hub) | ¿Dónde miro? (overview, todos los sitios) | Descubrimiento |
| **Horizon & sky** (skyline) | Modal de **detalle puntual** (D) | ¿Qué pasa en este sitio? (leer, preciso) | Analítica |

El **detalle puntual** = skyline del sitio + panel de métricas de ese sitio, en un modal. El **Top 3** no es una tercera vista: es una comparación (ranking) que arma el frontend con las métricas por sitio del backend.

### 2.3 Sincronización por azimut (el "cono") — secundario

- El skyline tiene una **ventana de azimut** (banda vertical, p. ej. 120°); el mapa, un **cono de visión** (cuña) en el sitio activo que refleja esa misma ventana.
- Con el detalle como modal sobre el mapa, esta sincronización pasa a ser **secundaria**: para el MVP el skyline es autosuficiente (lleva su propia ventana de azimut) y el cono en el mapa queda como mejora. No bloquear el flujo por esto.


---

## 3. Física (el núcleo diferenciador)

### 3.0 Convenciones e invariantes (fijar una vez, respetar en todo el código)

- **Azimut:** 0° = Norte, sentido horario hacia el Este (N→E→S→O). Vale para la máscara `h(az)`, los tracks de Sol/Tierra, el cono del mapa y la ventana del skyline. **Mismo cero y mismo sentido en todos** (el bug más caro de este proyecto es mezclarlos).
- **Marco espacial:** ENU local (East-North-Up) del sitio, derivado del marco MOON_ME.
- **Tiempo:** todo en UTC (lo que pedimos y cacheamos de Horizons). Un único reloj en backend y UI.
- **Ángulos:** grados en la API y la UI; radianes solo internos.
- **CRS del mapa/DEM:** estereográfica polar sur, esfera R=1737.4 km. NO asumir meridiano/paralelo: leerlos de los metadatos del raster PGDA con `rasterio` y reusar esa definición en `pyproj`.

Constantes Generales:
- Constante solar: `S ≈ 1361 W/m²` (varía ~±3% por distancia Sol-Luna en el año).
- Radio lunar: `R = 1737.4 km`.
- Radio angular del Sol: `~0.27°` (disco ~0.53°).
- Radio angular de la Tierra desde la Luna: `ρ = arcsin(R_Tierra / d)`, con `R_Tierra = 6371 km` y `d` = distancia Tierra-Luna (356.500–406.700 km) → `ρ ≈ 0.90°–1.02°` (~0.95° típico). Calcular por instante con `d` real.
- Oblicuidad lunar respecto a la eclíptica: `~1.5°` → en el polo el Sol nunca sube más que unos pocos grados.
- Libración: la Tierra oscila `~±7°` en el cielo del polo, ciclos de ~1 mes.

### 3.1 Potencia / iluminación

**No es binario.** Dos sitios "iluminados" reciben intensidades muy distintas. Irradiancia sobre una superficie:

```
E(t) = S · max(0, n̂ · ŝ(t)) · V(t)   [W/m²]
```

- `n̂` = normal de la superficie; `ŝ(t)` = dirección al Sol.
- Panel horizontal: `n̂ · ŝ = sin(e)`, con `e` = elevación solar. En el polo `e` es chica → potencia chica.
  - e=1° → ~24 W/m²; e=3° → ~71 W/m²; e=10° → ~236 W/m². Pocos grados cambian ×3.
- `V(t) ∈ [0,1]` = fracción del disco solar visible (0 tapado, 1 libre, intermedio en penumbra).

**Métrica correcta: energía integrada.**
```
E_total = ∫ E(t) dt   [Wh/m², /1000 = kWh/m²]   (suma numérica, Δt = 10–30 min)
```
El % de tiempo iluminado NO basta: un sitio al 30% con Sol más alto puede rendir más que uno al 50% con Sol rasante.

**No descartar:** noche continua más larga ("longest night"). Un sitio con mucha energía total pero noche de 100 h puede ser inviable (frío). Dos preguntas distintas: cuánta energía / cuánto aguanto sin ella. En sí, al clicar un sitio podrían aparecer cartuchos de tiempo (días terrestres) donde hay o no iluminación y otro set de cartuchos donde hay visibilidad a Tierra. 

### 3.2 Comunicaciones (visibilidad de la Tierra)

Tipo "cliff" (hay enlace o no), distinto de la potencia analógica. No inventar link budget (el brief no define antena/potencia/banda).

**Condición de visibilidad:**
```
elevación_Tierra(t) > h(azimut_Tierra(t)) + margen
```
- `h(az)` = máscara de horizonte (ver 3.3).
- `margen` = parámetro ajustable:
  - `margen = 0` → centro de la Tierra justo sobre la cresta ("visibilidad geométrica"). El horizonte parte el disco por la mitad.
  - `margen = +ρ (~0.95°)` → disco completo sobre el terreno (borde inferior roza).
  - `margen = +0.3° a +0.7°` → criterio de enlace viable (difracción / zona de Fresnel).
- **Fresnel:** con línea de vista rasando una cresta hay pérdida por difracción. Primer radio `r₁ ≈ √(λ·d₁)`. Ej. banda X (8.4 GHz) a 1 km: r₁≈6 m ≈ 0.34°; banda S (2.2 GHz): ~0.67°. Décimas de grado → el margen positivo lo cubre. Las frecuencias son típicas, no del brief.
- El margen también absorbe el error del DEM (resolución finita), altura de antena e inclinación del lander.
- **Default = 0 (geométrico, reproducible), slider 0°–1°.** Mostrar comparación: "con margen 0 hay X%, con 0.5° baja a Y%" → mide fragilidad del sitio.

**Geometría:** Luna en rotación sincrónica → la Tierra casi no se mueve en el cielo, oscila por libración (~±7°). En el polo exacto su elevación media es ~0° y oscila ~±6.7° por libración en latitud → **queda pegada al horizonte**. Fuera del polo hay un offset por latitud. Implicación fuerte: las comms dependen casi enteramente de estar en un **punto alto local** (borde de cráter); la máscara de horizonte pesa mucho más acá que en la potencia. (Valores aprox, validar con Horizons.)

**Métricas de comms:**
- % del tiempo con Tierra visible (sobre máscara + margen).
- **Mayor corte continuo** sin Tierra (análogo a la noche más larga; crítico: días sin poder recibir comandos).
- Cantidad y duración de ventanas.

**Sesgo a corregir:** los rasters oficiales de "Earth visibility" cuentan la Tierra como visible si asoma cualquier parte del disco → optimistas para un enlace real. Nuestro margen positivo es más honesto.

### 3.3 Máscara de horizonte `h(az)` (la pieza central)

Para un punto, por cada azimut, la elevación mínima sobre la cual el cielo está libre (debajo hay terreno).

```
h(az) = máx. ángulo de elevación del terreno visible en esa dirección
```

Cálculo desde el DEM:
1. Para cada azimut, recorrer el terreno en esa dirección (ray casting sobre el raster).
2. Para cada punto a distancia `s` y altura `Δz` relativa al observador, elevación angular `= atan2(Δz_corregido, s)`.
3. **Incluir curvatura lunar:** la caída es `≈ s²/(2R)`. A 10 km son ~29 m (R=1737.4 km). No despreciable frente a relieves de decenas de m. `Δz_corregido = Δz_terreno − s²/(2R)`.
4. El horizonte lo fijan tanto crestas cercanas (necesitan alta resolución) como bordes de cráter lejanos (con resolución gruesa alcanza, son features grandes).
5. Guardar `h(az)` como array (p. ej. 360 o 720 muestras de azimut).

**La máscara se calcula en el BACKEND, una vez por sitio. El frontend solo dibuja.**

### 3.4 Riesgos físicos que otros probablemente ignoren (diferenciadores)

- **Eclipses de Sol por la Tierra** vistos desde la Luna: horas sin Sol aunque la geometría diga "iluminado".
- **Disco solar finito (penumbra):** a e~1° la penumbra importa; Sol puntual sobreestima.
- **Dispersión del aterrizaje:** la elipse de error es de cientos de m; a pocos m cambia el horizonte. En vez de un valor puntual, calcular probabilidad de iluminación / línea de vista sobre la elipse (Monte Carlo). Responde directo al "pequeños cambios, gran impacto" del brief.
- **Libración** en la visibilidad de la Tierra.

Honestidad: estos son opcionales. Priorizar máscara + energía integrada + visibilidad con margen. Los demás, si sobra tiempo.

---

## 4. Datos (exacto qué bajar y servir)

Todo se **baja y se sirve nosotros**. No hay API de consulta útil para topografía/iluminación. Única excepción: efemérides (JPL Horizons), que se bajan una vez y se cachean en disco. Para el hackathon, self-host todo (no depender de la red del venue).

Proyección compartida de todo: **estereográfica polar sur, marco MOON_ME, efemérides DE421**. El mapa (imagen) y el DEM comparten proyección → un click indexa ambos con una sola conversión de coordenadas (usar `pyproj`).

### 4.1 Fondo del mapa (NO es DEM, es imagen de métrica precalculada)

Promedios de largo plazo (~18.6 años). Formato: usar **TIF** (o COG). Leer con `rasterio`.

- Iluminación solar, 85°S–90°S, 60 m/px:
  `https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF`
- Iluminación solar, 75°S–90°S, 120 m/px:
  `https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF`
- Visibilidad de la Tierra (capa comms), 85°S–90°S:
  `https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF`
- Sombra permanente (PSR), overlay:
  `https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF`

Página: PGDA "Lunar Polar Illumination" (producto 69) — https://pgda.gsfc.nasa.gov/products/69

**Caveat clave:** estos promedios NO dependen de la fecha → sirven como capa base del mapa ("dónde mirar en promedio"), pero NO cambian con el slider de fecha. Lo que depende de la fecha es la vista por sitio (skyline), que se calcula en vivo. División honesta: el mapa orienta, el sitio da el detalle temporal.

### 4.2 DEM polar (para la máscara)

Elevación en metros, estereográfica polar, MOON_ME/DE421.

**Caballito de batalla (casquete entero, cualquier sitio):**
- `LDEM_80S_80MPP_ADJ.TIF` — 80 m/px, 80–90°S, **181 MB**:
  `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF`
- Si 80 m queda grueso: `LDEM_80S_40MPP_ADJ.TIF` (40 m, 685 MB). NO bajar el de 20 m (2.6 GB) salvo necesidad.
- Página: PGDA producto 90 — https://pgda.gsfc.nasa.gov/products/90


**(Opcional / stretch) Alta resolución 5 m por sitio.** Si sobra tiempo y se quiere detalle cercano en un sitio de demo, PGDA tiene DEMs a 5 m de sitios candidatos reales de Artemis (Shackleton, de Gerlache, Nobile, Malapert). NO es para el MVP: combinar un tile local de 5 m con el casquete de 80 m (mosaiquear) agrega complejidad que no vale la pena en 48 h. Dejarlo anotado como mejora posterior.

Página: PGDA producto 78 — https://pgda.gsfc.nasa.gov/products/78 (archivos _surf.tif = elevación).

**Estrategia de resolución (MVP):** un solo DEM, el casquete de 80 m, para todos los sitios. Recortar una ventana alrededor del sitio y calcular la máscara ahí. Nada de tiling multi-LOD por zoom ni de mosaiquear resoluciones: complejidad innecesaria para 48 h. El 5 m y combinar tiles quedan como mejora opcional.

**OJO:** el DEM global (LDEM 118 m, cilíndrico simple) está muy distorsionado en el polo → NO usarlo para la máscara. Usar el polar. El "color shaded relief" es una foto, NO tiene elevación: no sirve para calcular.

### 4.3 Sol y Tierra (efemérides)

**Fuente única — JPL Horizons (API REST).** Observador = sitio lunar (coordenadas en el cuerpo, marco MOON_ME), target = Sol/Tierra → azimut + elevación respecto al horizonte local por instante, directo y sin setup de kernels. Bajar el rango de fechas **una sola vez** y cachearlo en disco (JSON/parquet): en el venue y en la demo se sirve desde el cache, sin red en vivo.

- Encapsular detrás de una función `ephem(site, t) → (az, el)` para no atar el resto del código a Horizons.
- Convención de salida: az/el en el marco ENU local del sitio (ver §3.0).
- Riesgo a mitigar: **pre-generar el cache desde antes del hackathon** por si Horizons no responde al momento de bajar.

### 4.4 Validación

Horizons es la fuente autoritativa de az/el, así que no se valida contra sí mismo; validamos lo que **derivamos** de esos tracks:
1. **Geometría / pipeline (sanity, en tests):** que el az/el de Horizons aplicado a la máscara dé resultados coherentes (Tierra pegada al horizonte en el polo, Sol siempre a pocos grados, ventanas de visibilidad razonables). Barato.
2. **Fracciones integradas (lit / Earth-vis)** → contra los rasters PGDA (69). OJO: esos rasters son promedios de ~18.6 años; para comparar hay que integrar nuestra cuenta sobre un período largo comparable, no sobre unos días. Caro: solo si sobra tiempo.

**IMPORTANTE:** Como checkmark hay volver a revisar la pestaña **Resources** del reto por si la NASA apunta a un dataset/API específico. Lo de arriba es lo estándar del campo, no necesariamente lo que el challenge espera.

### 4.5 Sitios semilla (para tener contenido de demo)

Lista inicial de sitios reales (regiones candidatas Artemis / rasgos conocidos del polo sur). Coordenadas aproximadas, **afinar contra el DEM antes de la demo**:

| Nombre | Lat | Lon | Nota |
|---|---|---|---|
| Shackleton (borde) | ~89.9°S | ~0° | Borde iluminado, interior en PSR |
| Connecting Ridge | ~89.4°S | ~222°E | "Pico de luz casi eterna" cerca de Shackleton |
| de Gerlache (borde) | ~88.5°S | ~292°E | Candidato Artemis |
| Nobile Rim | ~85.2°S | ~32°E | Región candidata Artemis III |
| Malapert Massif | ~86.0°S | ~0° | Alta visibilidad de Tierra |
| Haworth | ~87.5°S | ~5°E | Cráter con PSR |

---

## 5. Backend (precompute + API)

Stack: **FastAPI** (Python).

Pipeline por sitio (offline / on-demand):
1. Abrir DEM polar (`rasterio`), recortar ventana alrededor del sitio.
2. Convertir lat/lon del sitio a píxel (`pyproj`, estereográfica polar).
3. Calcular máscara `h(az)` (ray casting + curvatura lunar).
4. Calcular trayectorias Sol/Tierra (az, el por instante) desde el cache de Horizons para el rango de fechas.
5. Calcular métricas: energía integrada, % iluminado, % Tierra visible, ventanas tipo cartuchos.
6. Servir como JSON.

Contrato de datos (borrador). La **máscara** se calcula una vez por sitio y se cachea (no depende de la fecha); **tracks y métricas** dependen de la fecha. Endpoints separados para reflejarlo:
```
GET /api/mask?lat=&lon=
→ { site: { lat, lon, name },
    horizon_mask: [ {az, h_deg}, ... ] }        // 360/720 muestras, cacheado por sitio

GET /api/site?lat=&lon=&date=&window_days=      // window_days default ~30 (1 ciclo sinódico)
→ {
    site: { lat, lon, name },
    sun_track:   [ {t, az, el, visible}, ... ],
    earth_track: [ {t, az, el, visible}, ... ],
    metrics: {
      // superficies: panel horizontal y panel vertical orientado al Sol (tracking de azimut)
      energy_kwh_m2: { horizontal, vertical_sun_tracking },
      lit_fraction, longest_night_h,
      earth_vis_fraction, longest_comms_gap_h,
      next_sunset_h, next_earthset_h
    },
    params: { comms_margin_deg, window_days }
  }
GET /api/map?metric=illumination|earth|psr   → raster/tiles PNG precalculado
```
Nota: las métricas integradas (energía, longest_night) solo son representativas si `window_days` cubre ≥1 ciclo (~29.5 d); con ventanas cortas, etiquetarlas como "en la ventana elegida".

Frontend solo dibuja; nunca toca el DEM.

---

## 6. Frontend

Stack: HTML + CSS + JS Vanilla (2D; sin 3D). Pantallas según el flujo del §2.

- **Bienvenida:** texto corto / mini-tutorial + date-range picker. Enter → mapa.
- **South pole map (hub):** canvas 2D o PNG precalculado como fondo. ⭐ sitios predefinidos, 📍 chinchetas del usuario. Click en marcador → detalle (modal); click en zona libre → botón flotante (agregar 📍 / ver detalle). Cono de visión (cuña de azimut) en el sitio activo [secundario, §2.3], flechas de Sol/Tierra en el margen (muestran DIRECCIÓN, no visibilidad). Orientación: inset de globo, anillos de latitud (80°S borde, 85°S, 90°S centro), barra de escala (100 km), subtítulo "80°S–90°S · ~600 km".
- **Detalle puntual (modal sobre el mapa):** = skyline + panel de métricas del sitio. Skyline (SVG/canvas): eje x = azimut 0–360°, eje y = elevación. Silueta del terreno `h(az)`, trayectoria Sol y Tierra, cuenta regresiva a ocaso/Earthset, margen de comms punteado, ventana de azimut (banda). Legibilidad: Sol/Tierra **brillante = visible / apagado = tapado**, tramo tapado punteado, label "blocked by terrain". Rango vertical dinámico (piso ~5°) + botón "cielo completo" (0–90°).
- **Top 3 (modal sobre el mapa):** carrusel de 3 pasos (comms / energía / mixto). Cada paso: 3 tarjetas top + tabla de ranking de todos los sitios seleccionados; tarjetas y filas con botón "ver detalle".
- **Semáforos** potencia/comms y **lenguaje llano** en todas las etiquetas (ver §1.1).

Vista por defecto del cielo: **skyline** (más legible que la cenital para un casual).

---

## 7. Orden de construcción (prioridades, 48 h)

El hackathon es hoy. Cortar el diseño y construir. El jurado premia **correcto + útil** antes que vistoso.

1. **Backend máscara + trayectorias** (Horizons + DEM 80 m). La pieza central.
2. **Detalle puntual**: skyline + panel de métricas, con slider de tiempo (cumple el requisito de horizonte por sí solo).
3. **Mapa polar (hub)** (fondo = raster de iluminación) + sitios predefinidos ⭐ + click (marcador → detalle; zona libre → botón flotante agregar 📍 / detalle) + orientación.
4. **Bienvenida + date-range** (fija el rango global) y wiring del estado compartido (§2.1).
5. **Top 3**: carrusel (comms / energía / mixto) + tabla de ranking + semáforos potencia/comms.
6. Extra (si sobra tiempo): cono/sincronización por azimut (§2.3), Monte Carlo de dispersión, eclipses, modo guiado, exportar/compartir.

**Línea de corte MVP (lo que SÍ tiene que andar en la demo):** máscara de horizonte por sitio + tracks Sol/Tierra (vía Horizons) + detalle puntual (skyline + métricas) legible con cuenta regresiva + mapa hub con sitios predefinidos y poder agregar propios + Top 3 con ranking. El resto es mejora.

Regla: primero que el **skyline se entienda solo**. Nada de agregar features si la vista base no es legible.

---

## 8. Caveats / honestidad (para no prometer de más)

- Rasters de iluminación = promedios ~18.6 años, NO dependen de la fecha.
- Resolución del DEM limita la precisión de las sombras. No prometer modelo térmico completo.
- Márgenes (Fresnel, comms) = órdenes de magnitud, parametrizables, no del brief. Mostrar el valor usado.
- Validar números contra rasters oficiales antes de afirmarlos en la presentación.
- Revisar la pestaña Resources del reto.

---

## 9. Stack técnico (resumen)

- Backend: Python, FastAPI, rasterio, pyproj, numpy, httpx/requests (Horizons).
- Frontend: HTML + CSS + JS Vanilla, SVG/canvas para las 2 vistas 2D.
- Datos: LOLA DEM polar (PGDA), rasters de iluminación PGDA, cache de efemérides JPL Horizons.
- Validación: JPL Horizons, rasters PGDA 69.

---

## 10. Links

- Reto: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- PGDA iluminación (69): https://pgda.gsfc.nasa.gov/products/69
- PGDA DEM polar (90): https://pgda.gsfc.nasa.gov/products/90
- PGDA DEM 5 m sitios (78): https://pgda.gsfc.nasa.gov/products/78
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- JPL Horizons API (docs): https://ssd-api.jpl.nasa.gov/doc/horizons.html


## 11. Borrador sobre modo de trabajo optimo:

Reglas de Desarrollo Atómico
Límite de líneas: ~150 líneas por tarea atómica. Si una tarea es más grande, implementa solo la primera pieza lógica y detente.
Límite de caracteres por linea: Cuando hablamos de lenguajes de programacion como JavaScript, nunca escribas más de 100 caracteres por linea.
Desarrollo por fases: Ante cualquier requerimiento complejo, primero presenta un plan de pasos atómicos en formato de lista de verificación y espera mi confirmación antes de tocar código.
Prohibido asumir boilerplate: No escribas archivos enteros desde cero a menos que sea estrictamente necesario. Modifica únicamente las funciones o bloques solicitados.
Respetar contratos: Si una interfaz o tipo ya está definido, utilízalo; nunca inventes estructuras paralelas ni dupliques lógica.
Metodologia de desarrollo: TDD concentrado en el núcleo físico (máscara, integración de energía, az/el, condición de visibilidad) — ahí la correctitud es el diferenciador y se valida contra Horizons. En UI/plumbing, tests livianos para no frenar en 48 h.
Estetica y diseño: Siempre prioriza los diseños simples e intuitivos. La prioridad es que la app sea sencilla de entender y usar.
Cuando se implementen nuevas porciones de código, el agente deberá explicarle al programador muy brevemente qué hizo. 

## 12. Combinación con código actual:

Repo canónico: **`/home/nacho/mega/codigo/GauchitoLunar`** (ahí se construye; mover este SPEC al repo). Hoy contiene solo un frontend vanilla (`index.html`, `script.js`, `styles.css`, `README.md`) con una UI de navegación en 3 pasos — **sin backend ni física**. Plan: conservar ese frontend como cascarón de UI y agregarle el backend FastAPI + el núcleo físico de este spec, ajustando la UI a las 2 vistas (mapa polar + skyline). Lo que contradiga la arquitectura de acá (p. ej. flujos que asuman datos inexistentes) se adapta o se descarta. 