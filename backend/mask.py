"""Máscara de horizonte h(az) por ray casting sobre el DEM (SPEC §3.3).

Pieza central y diferenciador → TDD. Por cada azimut (0=N, horario hacia el Este)
se marcha sobre el terreno y se toma el MÁXIMO ángulo de elevación, con corrección
de curvatura lunar: Δz_corr = Δz − s²/(2R). Se calcula una vez por sitio (backend);
el frontend solo dibuja.
"""

from __future__ import annotations

import math

import numpy as np

from constants import MASK_SAMPLES, MOON_RADIUS_M


def _sample_bilinear(z: np.ndarray, row: float, col: float) -> float:
    """Valor de z interpolado bilinealmente; NaN si cae fuera o sobre nodata."""
    r0, c0 = int(math.floor(row)), int(math.floor(col))
    if r0 < 0 or c0 < 0 or r0 + 1 >= z.shape[0] or c0 + 1 >= z.shape[1]:
        return float("nan")
    fr, fc = row - r0, col - c0
    z00, z01 = z[r0, c0], z[r0, c0 + 1]
    z10, z11 = z[r0 + 1, c0], z[r0 + 1, c0 + 1]
    top = z00 * (1 - fc) + z01 * fc
    bot = z10 * (1 - fc) + z11 * fc
    return top * (1 - fr) + bot * fr


_CHUNK = 512        # pasos por bloque al marchar (512 px = 41 km con 80 m/px)


def max_elevation_bound_deg(zmax: float, z0: float, s_m: float,
                            moon_radius_m: float = MOON_RADIUS_M) -> float:
    """Cota superior del ángulo de elevación de CUALQUIER terreno a distancia ≥ s.

    Con el punto más alto del DEM (zmax) el ángulo a distancia s es
    atan2(zmax−z₀−s²/2R, s), estrictamente decreciente en s. Cuando esa cota baja
    del máximo ya hallado en un azimut, marchar más lejos no puede cambiarlo.
    Para max≥0 equivale a d = √(2R·(zmax−z₀)); para horizontes negativos (sitio en
    una cima) corta más lejos, y por eso NO se usa solo esa fórmula.
    """
    dz = (zmax - z0) - s_m * s_m / (2.0 * moon_radius_m)
    return math.degrees(math.atan2(dz, s_m))


def _bilinear_vec(z: np.ndarray, row: np.ndarray, col: np.ndarray) -> np.ndarray:
    """Versión vectorizada de _sample_bilinear: NaN fuera del DEM o sobre nodata."""
    r0 = np.floor(row).astype(np.int64)
    c0 = np.floor(col).astype(np.int64)
    oob = (r0 < 0) | (c0 < 0) | (r0 + 1 >= z.shape[0]) | (c0 + 1 >= z.shape[1])
    r0 = np.where(oob, 0, r0)
    c0 = np.where(oob, 0, c0)
    fr, fc = row - np.floor(row), col - np.floor(col)
    top = z[r0, c0] * (1 - fc) + z[r0, c0 + 1] * fc
    bot = z[r0 + 1, c0] * (1 - fc) + z[r0 + 1, c0 + 1] * fc
    return np.where(oob, np.nan, top * (1 - fr) + bot * fr)


def compute_mask(
    z: np.ndarray,
    row0: float,
    col0: float,
    north_px: tuple[float, float],
    east_px: tuple[float, float],
    mpp: float,
    n_az: int = MASK_SAMPLES,
    max_km: float | None = None,
    moon_radius_m: float = MOON_RADIUS_M,
) -> np.ndarray:
    """Devuelve h(az) en grados, array de largo n_az (índice i ↔ az = i·360/n_az).

    north_px/east_px: versores locales en (drow, dcol). La dirección del azimut A es
    cos(A)·N̂ + sin(A)·Ê (horario desde el norte). Marcha por píxel y se queda con la
    elevación angular máxima del terreno (puede ser negativa). max_km=None → alcance
    adaptativo EXACTO: por azimut se marcha en bloques y se corta cuando la cota
    max_elevation_bound_deg ya no puede superar el máximo hallado (o se sale del DEM).
    Un número fuerza ese alcance fijo (tests / comparación).
    """
    z0 = _sample_bilinear(z, row0, col0)
    if math.isnan(z0):
        raise ValueError(f"Sitio sobre nodata o fuera del DEM (row={row0}, col={col0})")

    adaptive = max_km is None
    zmax = float(np.nanmax(z)) if adaptive else 0.0
    total = int(math.hypot(*z.shape)) + 2 if adaptive else int(max_km * 1000.0 / mpp)
    nr, nc = north_px
    er, ec = east_px
    out = np.full(n_az, -90.0, dtype="float64")

    for i in range(n_az):
        a = math.radians(i * 360.0 / n_az)
        dr = math.cos(a) * nr + math.sin(a) * er      # paso en filas (por píxel)
        dc = math.cos(a) * nc + math.sin(a) * ec      # paso en columnas
        k0 = 1
        while k0 <= total:
            k1 = min(k0 + _CHUNK - 1, total)
            steps = np.arange(k0, k1 + 1, dtype="float64")
            s = steps * mpp                           # distancia horizontal (m)
            zt = _bilinear_vec(z, row0 + dr * steps, col0 + dc * steps)
            bad = np.isnan(zt)
            n_ok = int(np.argmax(bad)) if bad.any() else len(zt)  # corta en 1er NaN/borde
            if n_ok:
                dz = (zt[:n_ok] - z0) - s[:n_ok] ** 2 / (2.0 * moon_radius_m)  # curvatura
                out[i] = max(out[i], float(np.degrees(np.arctan2(dz, s[:n_ok])).max()))
            if n_ok < len(zt):                        # tocó borde/nodata: terminó este az
                break
            k0 = k1 + 1
            if adaptive and max_elevation_bound_deg(
                    zmax, z0, k0 * mpp, moon_radius_m) <= out[i]:
                break
    return out


def mask_to_contract(h_deg: np.ndarray) -> list[dict]:
    """h(az) array → lista [{az, h_deg}] del contrato §5 (az 0=N horario)."""
    n = len(h_deg)
    return [{"az": round(i * 360.0 / n, 3), "h_deg": round(float(h_deg[i]), 4)}
            for i in range(n)]
