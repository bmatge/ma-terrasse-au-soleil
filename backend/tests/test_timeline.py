"""Tests for timeline service pure functions."""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.meteo import weather_summary
from app.services.timeline import _combined_status, _find_best_window

PARIS_TZ = ZoneInfo("Europe/Paris")


# ── _combined_status ──────────────────────────────────────────────


class TestCombinedStatus:
    def test_night_when_sun_below_horizon(self):
        """Negative sun altitude → nuit regardless of other params."""
        assert _combined_status(-5.0, True, 0) == "nuit"

    def test_night_when_sun_at_zero(self):
        """Sun altitude exactly 0 → nuit (<=0 check)."""
        assert _combined_status(0.0, True, 0) == "nuit"

    def test_shadow_when_not_urban_sunny(self):
        """Sun up but blocked by buildings → ombre_batiment."""
        assert _combined_status(30.0, False, 10) == "ombre_batiment"

    def test_couvert_high_cloud(self):
        """Cloud cover > 80 → couvert."""
        assert _combined_status(30.0, True, 85) == "couvert"

    def test_couvert_at_boundary_81(self):
        """Cloud cover = 81 → couvert (boundary just above 80)."""
        assert _combined_status(30.0, True, 81) == "couvert"

    def test_mitige_at_boundary_80(self):
        """Cloud cover exactly 80 → mitige (not > 80)."""
        assert _combined_status(30.0, True, 80) == "mitige"

    def test_mitige_cloud_65(self):
        """Cloud cover 65 → mitige (between 50 and 80)."""
        assert _combined_status(30.0, True, 65) == "mitige"

    def test_mitige_at_boundary_51(self):
        """Cloud cover = 51 → mitige (just above 50)."""
        assert _combined_status(30.0, True, 51) == "mitige"

    def test_soleil_at_boundary_50(self):
        """Cloud cover exactly 50 → soleil (not > 50)."""
        assert _combined_status(30.0, True, 50) == "soleil"

    def test_soleil_low_cloud(self):
        """Cloud cover 30 → soleil."""
        assert _combined_status(30.0, True, 30) == "soleil"

    def test_soleil_zero_cloud(self):
        """Cloud cover 0 → soleil."""
        assert _combined_status(45.0, True, 0) == "soleil"


# ── _find_best_window ─────────────────────────────────────────────


def _make_slots(statuses: list[str], start_hour: int = 10, start_min: int = 0) -> list[dict]:
    """Helper: build slot dicts from a list of status strings."""
    slots = []
    h, m = start_hour, start_min
    for s in statuses:
        slots.append({"time": f"{h:02d}:{m:02d}", "status": s})
        m += 15
        if m >= 60:
            h += 1
            m -= 60
    return slots


class TestFindBestWindow:
    def test_consecutive_sunny_slots(self):
        """Several sunny slots in a row → correct debut/fin/duree."""
        statuses = ["ombre_batiment", "soleil", "soleil", "soleil", "couvert"]
        result = _find_best_window(_make_slots(statuses))
        assert result == {"debut": "10:15", "fin": "11:00", "duree_minutes": 45}

    def test_no_sunny_slots(self):
        """No sunny slots at all → None."""
        statuses = ["ombre_batiment", "couvert", "mitige", "nuit"]
        assert _find_best_window(_make_slots(statuses)) is None

    def test_returns_longest_window(self):
        """Multiple sunny windows → returns the longest one."""
        statuses = [
            "soleil", "soleil",           # 2 slots (30 min)
            "couvert",
            "soleil", "soleil", "soleil",  # 3 slots (45 min) — longest
            "ombre_batiment",
            "soleil",                      # 1 slot (15 min)
        ]
        result = _find_best_window(_make_slots(statuses))
        assert result is not None
        assert result["debut"] == "10:45"
        assert result["fin"] == "11:30"
        assert result["duree_minutes"] == 45

    def test_sunny_window_at_start(self):
        """Sunny window starting at the very first slot."""
        statuses = ["soleil", "soleil", "couvert", "ombre_batiment"]
        result = _find_best_window(_make_slots(statuses))
        assert result == {"debut": "10:00", "fin": "10:30", "duree_minutes": 30}

    def test_sunny_window_at_end(self):
        """Sunny window ending at the last slot."""
        statuses = ["couvert", "ombre_batiment", "soleil", "soleil", "soleil"]
        result = _find_best_window(_make_slots(statuses))
        assert result == {"debut": "10:30", "fin": "11:15", "duree_minutes": 45}

    def test_single_sunny_slot(self):
        """Only one sunny slot → 15-minute window."""
        statuses = ["couvert", "soleil", "ombre_batiment"]
        result = _find_best_window(_make_slots(statuses))
        assert result == {"debut": "10:15", "fin": "10:30", "duree_minutes": 15}

    def test_all_slots_sunny(self):
        """All slots sunny → window covers entire range."""
        statuses = ["soleil", "soleil", "soleil", "soleil"]
        result = _find_best_window(_make_slots(statuses))
        assert result == {"debut": "10:00", "fin": "11:00", "duree_minutes": 60}

    def test_empty_slots(self):
        """Empty slot list → None."""
        assert _find_best_window([]) is None


# ── weather_summary ───────────────────────────────────────────────


class TestWeatherSummary:
    def test_sunny_morning_clear_afternoon(self):
        """Low cloud all day → 'Matin ensoleillé, après-midi dégagé'."""
        hourly = {f"{h:02d}:00": {"cloud_cover": 10} for h in range(24)}
        result = weather_summary(hourly, lang="fr")
        assert "Matin ensoleillé" in result
        assert "après-midi dégagé" in result

    def test_cloudy_morning_mixed_afternoon(self):
        """High cloud morning, moderate afternoon."""
        hourly = {}
        for h in range(8, 12):
            hourly[f"{h:02d}:00"] = {"cloud_cover": 90}
        for h in range(12, 18):
            hourly[f"{h:02d}:00"] = {"cloud_cover": 45}
        result = weather_summary(hourly, lang="fr")
        assert "Matin nuageux" in result
        assert "éclaircies l'après-midi" in result

    def test_empty_hourly_defaults_to_mixed(self):
        """Missing hour keys → defaults to cloud_cover=50, producing mixed."""
        result = weather_summary({}, lang="fr")
        # avg defaults to 50 which is 30 <= 50 < 60 → mixed
        assert "Éclaircies le matin" in result
        assert "éclaircies l'après-midi" in result

    def test_english_locale(self):
        """English translations are used when lang='en'."""
        hourly = {f"{h:02d}:00": {"cloud_cover": 10} for h in range(24)}
        result = weather_summary(hourly, lang="en")
        assert "Sunny morning" in result
        assert "clear afternoon" in result
