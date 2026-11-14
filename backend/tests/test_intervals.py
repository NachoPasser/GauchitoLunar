"""TDD de los intervalos contiguos / cartuchos (SPEC §3.1)."""

from datetime import datetime, timedelta, timezone

import pytest

from intervals import earth_intervals, sun_intervals, to_intervals
from metrics import longest_gap_h

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


def test_longest_dark_interval_matches_longest_gap_metric():
    """Consistencia: el mayor tramo 'dark' coincide con longest_night_h (±1 paso)."""
    flags = [True, False, False, False, True, False, True, True]
    track = _track(flags)
    darks = [x["duration_h"] for x in sun_intervals(track) if x["state"] == "dark"]
    longest_interval = max(darks)
    metric = longest_gap_h(track, STEP_MIN)
    assert abs(longest_interval - metric) <= STEP_MIN / 60.0 + 1e-6
