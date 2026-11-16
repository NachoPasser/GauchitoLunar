"""TDD de los intervalos contiguos / cartuchos (SPEC §3.1)."""

from datetime import datetime, timedelta, timezone

import pytest

from intervals import earth_intervals, sun_intervals, to_intervals
from metrics import compute_metrics

STEP_MIN = 20


def _track(vis_flags):
    """Construye un track con timestamps espaciados STEP_MIN min."""
    t0 = datetime(2026, 11, 14, tzinfo=timezone.utc)
    return [{"t": (t0 + i * timedelta(minutes=STEP_MIN)).isoformat(), "visible": v}
            for i, v in enumerate(vis_flags)]


def test_empty_track_returns_no_intervals():
    assert to_intervals([], "lit", "dark") == []


def test_single_state_is_one_clipped_interval():
    iv = sun_intervals(_track([True] * 5))
    assert len(iv) == 1
    assert iv[0]["state"] == "lit"
    assert iv[0]["clipped_start"] and iv[0]["clipped_end"]


def test_alternation_states_and_order():
    #      lit lit  dark dark dark  lit
    iv = sun_intervals(_track([True, True, False, False, False, True]))
    assert [x["state"] for x in iv] == ["lit", "dark", "lit"]
    assert iv[0]["clipped_start"] is True and iv[0]["clipped_end"] is False
    assert iv[-1]["clipped_end"] is True


def test_durations_in_hours_and_days():
    # 3 muestras lit → transición en la 4a: tramo = 3 pasos = 60 min = 1.0 h
    iv = sun_intervals(_track([True, True, True, False]))
    assert iv[0]["duration_h"] == pytest.approx(1.0)
    assert iv[0]["duration_days"] == pytest.approx(1.0 / 24, abs=0.01)  # 2 decimales


def test_earth_uses_visible_hidden_labels():
    iv = earth_intervals(_track([False, True, True]))
    assert {x["state"] for x in iv} == {"hidden", "visible"}


def test_longest_dark_interval_matches_longest_night_metric_exactly():
    """Consistencia: longest_night_h ES el mayor tramo 'dark' (misma fuente, sin ±1 paso)."""
    for flags in ([True, False, False, False, True, False, True, True],
                  [True, True, False, False, False]):       # corte pegado al final
        track = _track(flags)
        for p in track:
            p.update(az=0.0, el=10.0)
        darks = [x["duration_h"] for x in sun_intervals(track) if x["state"] == "dark"]
        metric = compute_metrics(track, track, STEP_MIN)["longest_night_h"]
        assert metric == max(darks)
