"""Efemérides de Sol y Tierra encapsuladas (SPEC §4.3).

Única puerta de entrada a las efemérides para el resto del código. Hoy lee del
cache en disco generado por fetch_horizons.py; mañana podría pegarle a Horizons
en vivo sin que cambie la firma. NO atar el resto del código a Horizons.

Convención de salida: az/el en grados, marco ENU local del sitio (SPEC §3.0).
"""

from __future__ import annotations

import bisect
import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = DATA_DIR / "horizons"

# Un sitio puede tener VARIOS rangos cacheados: el "base" ({lat}_{lon}_{target}.json, el que
# genera fetch_horizons.py o la primera descarga en vivo) y "extras" por rango pedido
# ({lat}_{lon}_{target}__{start}_{stop}.json). Una descarga en vivo de otro rango NUNCA
# reemplaza al base: así explorar fechas lejanas no destruye lo precalculado (clave sin red).
MAX_EXTRA_RANGES = 6      # extras por sitio y target; al pasarse se borran los más viejos

# cache en memoria: {(lat4, lon4, target): [(t0_epoch, t1_epoch, track, times), ...]} (uno por
# rango). `times` = los epochs del track, calculados UNA vez: reconstruirlos en cada consulta de
# _interp costaba O(n) por llamada (con un rango de un año, ~0.3 s por pedido).
_CACHE: dict[tuple, list[tuple]] = {}

# Un candado por sitio: pedidos en paralelo (el Top 3 lanza varios) no bajan ni escriben a la vez.
_LOCKS: dict[tuple, threading.Lock] = {}
_LOCKS_GUARD = threading.Lock()


def _site_lock(lat: float, lon: float) -> threading.Lock:
    key = (round(lat, 4), round(lon, 4))
    with _LOCKS_GUARD:
        return _LOCKS.setdefault(key, threading.Lock())


class EphemerisError(RuntimeError):
    """No se pudieron obtener efemérides (sin cache y sin red/Horizons caído)."""


def _cache_path(lat: float, lon: float, target: str) -> Path:
    """Ruta del JSON BASE cacheado para un sitio y target ('sun' | 'earth')."""
    return CACHE_DIR / f"{lat:+.4f}_{lon:+.4f}_{target}.json"


def _extra_paths(lat: float, lon: float, target: str) -> list[Path]:
    """Rangos extra cacheados (descargas en vivo de otras fechas), más viejos primero."""
    if not CACHE_DIR.exists():
        return []
    pat = f"{lat:+.4f}_{lon:+.4f}_{target}__*.json"
    return sorted(CACHE_DIR.glob(pat), key=lambda p: p.stat().st_mtime)


def has_cache(lat: float, lon: float, target: str = "sun") -> bool:
    return _cache_path(lat, lon, target).exists()


def _read_track(path: Path) -> list[tuple[float, float, float]]:
    raw = json.loads(path.read_text())
    track = [
        (datetime.fromisoformat(p["t"]).timestamp(), float(p["az"]), float(p["el"]))
        for p in raw["points"]
    ]
    track.sort(key=lambda r: r[0])
    return track


def _variants(lat: float, lon: float, target: str):
    """Rangos cacheados del sitio, cargados y memoizados: [(t0, t1, track), ...] con el base
    primero. Vacío si no hay nada. Un archivo ilegible (p. ej. a medio escribir) se ignora."""
    key = (round(lat, 4), round(lon, 4), target)
    if key in _CACHE:
        return _CACHE[key]
    paths = [_cache_path(lat, lon, target)] if has_cache(lat, lon, target) else []
    paths += _extra_paths(lat, lon, target)
    out = []
    for path in paths:
        try:
            track = _read_track(path)
        except (OSError, ValueError, KeyError):
            continue
        if len(track) >= 2:
            out.append((track[0][0], track[-1][0], track, [r[0] for r in track]))
    if out:                       # no memoizar el vacío: puede llegar un fetch después
        _CACHE[key] = out
    return out


def _cache_covers(lat: float, lon: float, target: str,
                  start: datetime, days: int) -> bool:
    """True si ALGUN rango cacheado cubre el intervalo [start, start+days]."""
    need_end = start + timedelta(days=days)
    return any(t0 <= start.timestamp() and t1 >= need_end.timestamp()
               for t0, t1, _, _ in _variants(lat, lon, target))


def _prune_extras(lat: float, lon: float) -> None:
    """Conserva solo los MAX_EXTRA_RANGES extras más nuevos por target."""
    for tgt in ("sun", "earth"):
        extras = _extra_paths(lat, lon, tgt)
        if len(extras) > MAX_EXTRA_RANGES:
            for old in extras[:-MAX_EXTRA_RANGES]:
                old.unlink(missing_ok=True)


def ensure_cache(lat: float, lon: float, start: datetime, days: int = 35,
                 step: str = "20m") -> None:
    """Garantiza cache de sun+earth para el sitio y el intervalo. Si ningún rango cacheado lo
    cubre, baja de Horizons EN VIVO (fetch on-miss, SPEC §4.3) y lo guarda: como rango base si
    el sitio no tenía nada, o como rango EXTRA si ya tenía (sin tocar el base). Lanza
    EphemerisError si no hay red / Horizons no responde, para que la API devuelva un error
    legible."""
    def covered() -> bool:
        return (_cache_covers(lat, lon, "sun", start, days)
                and _cache_covers(lat, lon, "earth", start, days))

    if covered():
        return
    with _site_lock(lat, lon):
        if covered():             # otro hilo lo bajó mientras esperábamos el candado
            return
        stop = (start + timedelta(days=days)).strftime("%Y-%m-%d")
        has_base = has_cache(lat, lon, "sun") and has_cache(lat, lon, "earth")
        start_s = start.strftime("%Y-%m-%d")
        try:
            from fetch_horizons import fetch_site
            if has_base:
                fetch_site(lat, lon, start_s, stop, step, tag=f"__{start_s}_{stop}")
            else:
                fetch_site(lat, lon, start_s, stop, step)
        except Exception as e:                  # red caída, timeout, parse vacío, etc.
            raise EphemerisError(
                f"Sin cache y falló el fetch en vivo a Horizons para ({lat}, {lon}): {e}"
            ) from e
        _prune_extras(lat, lon)
        for tgt in ("sun", "earth"):            # invalidar memo: hay un rango nuevo
            _CACHE.pop((round(lat, 4), round(lon, 4), tgt), None)


def _pick(lat: float, lon: float, target: str, epoch: float | None = None):
    """(track, times) del rango cacheado que contiene epoch (segundos UTC); sin epoch, o si
    ninguno lo contiene, el base."""
    variants = _variants(lat, lon, target)
    if not variants:
        raise FileNotFoundError(
            f"Sin cache de Horizons para {target} en ({lat}, {lon}): "
            f"{_cache_path(lat, lon, target)}. Corré backend/fetch_horizons.py primero."
        )
    if epoch is not None:
        for t0, t1, track, times in variants:
            if t0 <= epoch <= t1:
                return track, times
    return variants[0][2], variants[0][3]


def _load(lat: float, lon: float, target: str,
          epoch: float | None = None) -> list[tuple[float, float, float]]:
    """Track cacheado como lista ordenada por tiempo (ver _pick)."""
    return _pick(lat, lon, target, epoch)[0]


def _interp(track: list[tuple[float, float, float]], epoch: float,
            times: list[float] | None = None) -> tuple[float, float]:
    """Interpolación lineal de (az, el) al instante epoch (segundos UTC). `times` son los
    epochs del track ya calculados (si no se pasan, se calculan: más lento)."""
    if times is None:
        times = [r[0] for r in track]
    i = bisect.bisect_left(times, epoch)
    if i <= 0:
        return track[0][1], track[0][2]
    if i >= len(track):
        return track[-1][1], track[-1][2]
    t0, az0, el0 = track[i - 1]
    t1, az1, el1 = track[i]
    f = (epoch - t0) / (t1 - t0) if t1 != t0 else 0.0
    # az: interpolar por el camino corto para no romper en el wrap 360→0
    daz = ((az1 - az0 + 180.0) % 360.0) - 180.0
    az = (az0 + f * daz) % 360.0
    el = el0 + f * (el1 - el0)
    return az, el


def ephem(site: dict, t: datetime, target: str = "sun") -> tuple[float, float]:
    """(az, el) en grados del `target` ('sun' | 'earth') visto desde `site`, en `t` (UTC).

    `site` es un dict con al menos {'lat', 'lon'}. Lee del cache en disco.
    """
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    epoch = t.timestamp()
    track, times = _pick(site["lat"], site["lon"], target, epoch)
    return _interp(track, epoch, times)
