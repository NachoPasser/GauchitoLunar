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


def compute_mask(
    z: np.ndarray,
    row0: float,
    col0: float,
    north_px: tuple[float, float],
    east_px: tuple[float, float],
    mpp: float,
    n_az: int = MASK_SAMPLES,
    max_km: float = 50.0,
    moon_radius_m: float = MOON_RADIUS_M,
) -> np.ndarray:
    """Devuelve h(az) en grados, array de largo n_az (índice i ↔ az = i·360/n_az).

    north_px/east_px: versores locales en (drow, dcol). La dirección del azimut A es
    cos(A)·N̂ + sin(A)·Ê (horario desde el norte). Marcha por píxel hasta max_km y se
    queda con la elevación angular máxima del terreno (puede ser negativa).
    """
    z0 = _sample_bilinear(z, row0, col0)
    if math.isnan(z0):
        raise ValueError(f"Sitio sobre nodata o fuera del DEM (row={row0}, col={col0})")

    nr, nc = north_px
    er, ec = east_px
    max_steps = int(max_km * 1000.0 / mpp)
    out = np.empty(n_az, dtype="float64")

    for i in range(n_az):
        a = math.radians(i * 360.0 / n_az)
        dr = math.cos(a) * nr + math.sin(a) * er     # paso en filas (por píxel)
        dc = math.cos(a) * nc + math.sin(a) * ec     # paso en columnas
        max_e = -90.0
        for step in range(1, max_steps + 1):
            row = row0 + dr * step
            col = col0 + dc * step
            zt = _sample_bilinear(z, row, col)
            if math.isnan(zt):
                break
            s = step * mpp                            # distancia horizontal (m)
            dz = (zt - z0) - s * s / (2.0 * moon_radius_m)   # curvatura lunar
            e = math.degrees(math.atan2(dz, s))
            if e > max_e:
                max_e = e
        out[i] = max_e
    return out


def mask_to_contract(h_deg: np.ndarray) -> list[dict]:
    """h(az) array → lista [{az, h_deg}] del contrato §5 (az 0=N horario)."""
    n = len(h_deg)
    return [{"az": round(i * 360.0 / n, 3), "h_deg": round(float(h_deg[i]), 4)}
            for i in range(n)]
