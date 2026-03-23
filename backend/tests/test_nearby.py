"""Tests for nearby service pure functions."""
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from app.services.nearby import _estimate_sun_until_single as _estimate_sun_until

PARIS_TZ = ZoneInfo("Europe/Paris")
PARIS_LAT = 48.853
PARIS_LON = 2.369
DUMMY_PROFILE = [0.0] * 360  # flat horizon


class TestEstimateSunUntil:
    def test_loses_sun_after_2_hours(self):
        """Terrace sunny for 2h (8 checks) then shadow → returns correct HH:MM."""
        from_dt = datetime(2026, 6, 21, 14, 0, tzinfo=PARIS_TZ)
        call_count = 0

        def mock_is_sunny(profile, alt, azi):
            nonlocal call_count
            call_count += 1
            # First 8 checks (2 hours) sunny, then shadow
            return call_count <= 8

        with (
            patch("app.services.nearby.get_sun_position", return_value=(40.0, 220.0)),
            patch("app.services.nearby.is_sunny", side_effect=mock_is_sunny),
        ):
            result = _estimate_sun_until(DUMMY_PROFILE, PARIS_LAT, PARIS_LON, from_dt)

        # 8 sunny checks × 15 min = 2h → loses sun at check 9 = 14:00 + 9×15min = 16:15
        assert result == "16:15"

    def test_stays_sunny_beyond_window(self):
        """Terrace sunny for 4+ hours → returns None."""
        from_dt = datetime(2026, 6, 21, 12, 0, tzinfo=PARIS_TZ)

        with (
            patch("app.services.nearby.get_sun_position", return_value=(50.0, 200.0)),
            patch("app.services.nearby.is_sunny", return_value=True),
        ):
            result = _estimate_sun_until(DUMMY_PROFILE, PARIS_LAT, PARIS_LON, from_dt)

        assert result is None

    def test_immediate_shadow(self):
        """Terrace loses sun at the very first check (15 min ahead)."""
        from_dt = datetime(2026, 6, 21, 17, 0, tzinfo=PARIS_TZ)

        with (
            patch("app.services.nearby.get_sun_position", return_value=(10.0, 280.0)),
            patch("app.services.nearby.is_sunny", return_value=False),
        ):
            result = _estimate_sun_until(DUMMY_PROFILE, PARIS_LAT, PARIS_LON, from_dt)

        # First check is from_dt + 15min = 17:15
        assert result == "17:15"

    def test_loses_sun_after_1_hour(self):
        """Terrace sunny for 1h (4 checks) then shadow."""
        from_dt = datetime(2026, 3, 21, 15, 30, tzinfo=PARIS_TZ)
        call_count = 0

        def mock_is_sunny(profile, alt, azi):
            nonlocal call_count
            call_count += 1
            return call_count <= 4

        with (
            patch("app.services.nearby.get_sun_position", return_value=(25.0, 240.0)),
            patch("app.services.nearby.is_sunny", side_effect=mock_is_sunny),
        ):
            result = _estimate_sun_until(DUMMY_PROFILE, PARIS_LAT, PARIS_LON, from_dt)

        # 4 sunny × 15min = 1h, loses sun at check 5 = 15:30 + 5×15min = 16:45
        assert result == "16:45"
