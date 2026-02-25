"""Tests for solar position calculations."""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.sun import get_sun_position, get_sunrise_sunset

PARIS_TZ = ZoneInfo("Europe/Paris")
PARIS_LAT = 48.8566
PARIS_LON = 2.3522


class TestGetSunPosition:
    def test_midday_summer_sun_is_high(self):
        """Summer solstice midday: sun should be high (~65°) and roughly south."""
        dt = datetime(2026, 6, 21, 13, 0, tzinfo=PARIS_TZ)
        alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
        assert 55 < alt < 70, f"Summer midday altitude should be ~65°, got {alt}"
        assert 150 < azi < 210, f"Midday azimuth should be roughly south, got {azi}"

    def test_midday_winter_sun_is_low(self):
        """Winter solstice midday: sun should be low (~18°) and south."""
        dt = datetime(2025, 12, 21, 12, 30, tzinfo=PARIS_TZ)
        alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
        assert 10 < alt < 25, f"Winter midday altitude should be ~18°, got {alt}"
        assert 160 < azi < 200, f"Midday azimuth should be south, got {azi}"

    def test_night_altitude_negative(self):
        """At 2am, sun should be below the horizon."""
        dt = datetime(2026, 3, 15, 2, 0, tzinfo=PARIS_TZ)
        alt, _ = get_sun_position(PARIS_LAT, PARIS_LON, dt)
        assert alt < 0, f"Night altitude should be negative, got {alt}"

    def test_morning_sun_is_east(self):
        """Morning sun should be in the eastern half."""
        dt = datetime(2026, 6, 21, 8, 0, tzinfo=PARIS_TZ)
        alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
        assert alt > 0, "Sun should be above horizon at 8am in June"
        assert 45 < azi < 135, f"Morning azimuth should be east-ish, got {azi}"

    def test_evening_sun_is_west(self):
        """Evening sun should be in the western half."""
        dt = datetime(2026, 6, 21, 19, 0, tzinfo=PARIS_TZ)
        alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
        assert alt > 0, "Sun should be above horizon at 7pm in June"
        assert 250 < azi < 320, f"Evening azimuth should be west-ish, got {azi}"

    def test_azimuth_always_in_range(self):
        """Azimuth should always be in [0, 360)."""
        for hour in range(24):
            dt = datetime(2026, 3, 21, hour, 0, tzinfo=PARIS_TZ)
            _, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
            assert 0 <= azi < 360, f"Azimuth out of range at {hour}h: {azi}"


class TestGetSunriseSunset:
    def test_summer_long_days(self):
        """Summer days should be long (sunrise ~6am, sunset ~9:30pm)."""
        dt = datetime(2026, 6, 21, 12, 0, tzinfo=PARIS_TZ)
        sunrise, sunset = get_sunrise_sunset(PARIS_LAT, PARIS_LON, dt)
        assert sunrise.hour <= 6, f"Summer sunrise should be by 6am, got {sunrise}"
        assert sunset.hour >= 21, f"Summer sunset should be after 9pm, got {sunset}"

    def test_winter_short_days(self):
        """Winter days should be short (sunrise ~8:30am, sunset ~5pm)."""
        dt = datetime(2025, 12, 21, 12, 0, tzinfo=PARIS_TZ)
        sunrise, sunset = get_sunrise_sunset(PARIS_LAT, PARIS_LON, dt)
        assert sunrise.hour >= 8, f"Winter sunrise should be after 8am, got {sunrise}"
        assert sunset.hour <= 17, f"Winter sunset should be by 5pm, got {sunset}"
