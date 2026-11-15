"""Intervalos contiguos de estado a partir de un track (SPEC §3.1 — "cartuchos").

Deriva, de los mismos sun_track/earth_track que ya calcula el backend, la
secuencia de tramos continuos de un estado (Sol: lit/dark; Tierra: visible/hidden).
El frontend los dibuja como cartuchos (ancho ∝ duración). Al derivarse del track,
nunca se contradicen con el skyline ni con las métricas.

El cambio de estado se atribuye a la siguiente muestra (el tramo i..j abarca
[t_i, t_{j+1})). Los tramos primero/último tocan el borde de la ventana →
clipped_start/clipped_end para que la UI los dibuje abiertos (honestidad §5).
"""

from __future__ import annotations

from datetime import datetime


def to_intervals(track: list[dict], state_true: str, state_false: str) -> list[dict]:
    """Track con flag `visible` → lista de tramos contiguos de estado."""
    if not track:
        return []
    n = len(track)
    times = [datetime.fromisoformat(p["t"]) for p in track]

    out: list[dict] = []
    i = 0
    while i < n:
        vis = track[i]["visible"]
        j = i
        while j + 1 < n and track[j + 1]["visible"] == vis:
            j += 1
        start = times[i]
        # último tramo: j+1 no existe → usar j; si i==j el tramo es un punto, dur=0
        end = times[j + 1] if j + 1 < n else times[j]
        dur_h = max(0.0, (end - start).total_seconds() / 3600.0)
        out.append({
            "state": state_true if vis else state_false,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "duration_h": round(dur_h, 2),
            "duration_days": round(dur_h / 24.0, 2),
            "clipped_start": i == 0,
            "clipped_end": j == n - 1,
        })
        i = j + 1
    return out


def sun_intervals(sun_track: list[dict]) -> list[dict]:
    return to_intervals(sun_track, "lit", "dark")


def earth_intervals(earth_track: list[dict]) -> list[dict]:
    return to_intervals(earth_track, "visible", "hidden")
