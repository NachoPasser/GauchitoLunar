"""Invariantes físicos y de convención del proyecto (SPEC §3.0).

FUENTE ÚNICA. Todo el código (máscara, tracks, energía, comms, UI vía API)
debe leer de acá. El bug más caro del proyecto es mezclar convenciones de
ángulo; fijarlas una sola vez y respetarlas en todos lados.
"""

# --- Constantes físicas generales (SPEC §3.0) ---
SOLAR_CONSTANT_W_M2 = 1361.0       # S ≈ 1361 W/m² (±3% por distancia Sol-Luna)
MOON_RADIUS_KM = 1737.4            # R lunar, esfera usada en CRS y curvatura
MOON_RADIUS_M = MOON_RADIUS_KM * 1000.0
EARTH_RADIUS_KM = 6371.0           # para el radio angular de la Tierra
SUN_ANGULAR_RADIUS_DEG = 0.27      # disco solar ~0.53°

# Rango de distancia Tierra-Luna (km) → radio angular Tierra ρ ≈ 0.90°–1.02°.
# Calcular ρ por instante con d real: ρ = arcsin(EARTH_RADIUS_KM / d).
EARTH_MOON_DIST_MIN_KM = 356500.0
EARTH_MOON_DIST_MAX_KM = 406700.0

# --- Convención de azimut (SPEC §3.0) ---
# 0° = Norte, sentido horario hacia el Este (N→E→S→O).
# Mismo cero y mismo sentido en: máscara h(az), tracks Sol/Tierra,
# cono del mapa y ventana del skyline.
AZIMUTH_ZERO = "north"
AZIMUTH_CLOCKWISE = True           # N→E→S→O

# --- Marco espacial y tiempo (SPEC §3.0) ---
SPATIAL_FRAME = "ENU"              # East-North-Up local, derivado de MOON_ME
BODY_FRAME = "MOON_ME"
EPHEMERIS = "DE441"                # la que Horizons declara en su respuesta ({source: DE441})
TIME_SCALE = "UTC"                 # un único reloj en backend y UI

# --- CRS del mapa/DEM (SPEC §3.0, §4) ---
# Estereográfica polar sur, esfera R = MOON_RADIUS_KM.
# NO asumir meridiano/paralelo: leerlos de los metadatos del raster con
# rasterio y reusar esa definición en pyproj. Esto es solo el fallback.
CRS_PROJECTION = "stereographic_south_polar"

# --- Máscara de horizonte (SPEC §3.3) ---
MASK_SAMPLES = 360                 # muestras de azimut (360 o 720)
# Corrección por curvatura lunar en el ray casting: Δz_corr = Δz − s²/(2R).

# --- Energía integrada (SPEC §3.1) ---
# E_total = ∫ S·max(0, sin e)·V(t) dt  [Wh/m²] /1000 = kWh/m²
INTEGRATION_STEP_MIN = 20          # Δt de la suma numérica (10–30 min)

# --- Comunicaciones (SPEC §3.2) ---
# Condición: elevación_Tierra(t) > h(az_Tierra(t)) + margen.
COMMS_MARGIN_DEFAULT_DEG = 0.0     # geométrico, reproducible; slider 0°–1°
COMMS_MARGIN_MIN_DEG = 0.0
COMMS_MARGIN_MAX_DEG = 1.0

# --- Ventana temporal (SPEC §5) ---
WINDOW_DAYS_DEFAULT = 30           # ~1 ciclo sinódico (29.5 d)
SYNODIC_MONTH_DAYS = 29.53         # métricas integradas solo representativas si window ≥ esto

# --- Unidades en el borde (SPEC §3.0) ---
# Grados en API y UI; radianes solo internos.
