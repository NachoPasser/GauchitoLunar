"""Física solar auxiliar: distancia Sol–Luna (1/r²) y disco solar finito (SPEC §3.1).

La irradiancia depende de la distancia: S(t) = S₁ᵤₐ / r², con ±3,4 % de oscilación anual
(perihelio ~3-ene, afelio ~6-jul). El cache de Horizons trae solo az/el, así que se usa la
distancia Sol–TIERRA analítica (Almanaque Astronómico, error ~1e-4 UA): la Luna está a
≤ 0,0027 UA de la Tierra, o sea ≤ 0,27 % en r (≤ 0,5 % en S, oscila cada mes). Es un orden
de magnitud documentado, no una efeméride.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from constants import SOLAR_CONSTANT_W_M2

_J2000 = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)


def solar_distance_au(t: datetime) -> float:
    """Distancia Sol–Tierra en UA para el instante t (UTC)."""
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    days = (t - _J2000).total_seconds() / 86400.0
    g = math.radians((357.529 + 0.98560028 * days) % 360.0)      # anomalía media
    return 1.00014 - 0.01671 * math.cos(g) - 0.00014 * math.cos(2.0 * g)


def solar_irradiance(t: datetime) -> float:
    """Irradiancia solar normal (W/m²) al instante t: S₁ᵤₐ / r²."""
    return SOLAR_CONSTANT_W_M2 / solar_distance_au(t) ** 2


def solar_disc_fraction(x_deg: float, radius_deg: float) -> float:
    """Fracción del disco solar sobre el horizonte.

    x_deg = elevación del centro − elevación del horizonte; radius_deg = radio angular
    del disco. Segmento circular con el horizonte tratado como recta en el ancho del
    disco (~0,5°): 0,5 + (u·√(1−u²) + asin u)/π, con u = x/ρ acotado a [−1, 1].
    """
    u = max(-1.0, min(1.0, x_deg / radius_deg))
    return 0.5 + (u * math.sqrt(1.0 - u * u) + math.asin(u)) / math.pi
