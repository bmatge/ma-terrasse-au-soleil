"""Tests for shadow/horizon profile logic."""
from app.services.shadow import (
    compute_horizon_profile_sync,
    is_sunny,
    _fill_azimuth_range,
)
import numpy as np


class TestIsSunny:
    def test_sun_below_horizon(self):
        """Sun below horizon (negative altitude) is never sunny."""
        profile = [0.0] * 360
        assert is_sunny(profile, -5.0, 180.0) is False

    def test_sun_above_flat_horizon(self):
        """Sun above flat horizon (no buildings) should be sunny."""
        profile = [0.0] * 360
        assert is_sunny(profile, 30.0, 180.0) is True

    def test_sun_blocked_by_building(self):
        """Sun at 20° blocked by building at 25° elevation should not be sunny."""
        profile = [0.0] * 360
        profile[180] = 25.0  # Building blocking south at 25° elevation
        assert is_sunny(profile, 20.0, 180.0) is False

    def test_sun_clears_building(self):
        """Sun at 30° clears building at 25° elevation."""
        profile = [0.0] * 360
        profile[180] = 25.0
        assert is_sunny(profile, 30.0, 180.0) is True

    def test_sun_at_exact_horizon_angle(self):
        """Sun exactly at the obstacle angle is not sunny (needs to clear it)."""
        profile = [0.0] * 360
        profile[90] = 15.0
        assert is_sunny(profile, 15.0, 90.0) is False

    def test_different_azimuths_independent(self):
        """Building to the south doesn't affect sun from the east."""
        profile = [0.0] * 360
        profile[180] = 45.0  # Tall building blocking south
        assert is_sunny(profile, 10.0, 90.0) is True  # Sun from east, no obstacle

    def test_azimuth_wrapping(self):
        """Azimuth 360 should wrap to 0 (north)."""
        profile = [0.0] * 360
        profile[0] = 20.0
        assert is_sunny(profile, 15.0, 360.0) is False


class TestFillAzimuthRange:
    def test_single_degree(self):
        """Same azimuth for both endpoints fills a single cell."""
        profile = np.zeros(360)
        _fill_azimuth_range(profile, 90.0, 15.0, 90.0, 15.0)
        assert profile[90] == 15.0
        assert profile[91] == 0.0

    def test_small_range(self):
        """Fill a small azimuth range."""
        profile = np.zeros(360)
        _fill_azimuth_range(profile, 80.0, 10.0, 85.0, 20.0)
        assert profile[80] > 0
        assert profile[85] > 0
        # Intermediate values should be interpolated
        assert profile[82] > 0
        assert profile[79] == 0  # Outside range

    def test_wrapping_around_north(self):
        """Range crossing 0° (e.g., 355° to 5°)."""
        profile = np.zeros(360)
        _fill_azimuth_range(profile, 355.0, 10.0, 5.0, 10.0)
        assert profile[355] > 0
        assert profile[0] > 0
        assert profile[5] > 0

    def test_preserves_higher_values(self):
        """Should only update cells if new value is higher."""
        profile = np.zeros(360)
        profile[90] = 20.0
        _fill_azimuth_range(profile, 88.0, 10.0, 92.0, 10.0)
        assert profile[90] == 20.0  # Existing value preserved (higher)
        assert profile[88] == 10.0  # New value set


class TestComputeHorizonProfileSync:
    def test_no_buildings(self):
        """No buildings → flat profile (all zeros)."""
        profile = compute_horizon_profile_sync([], 48.8566, 2.3522)
        assert len(profile) == 360
        assert all(v == 0.0 for v in profile)

    def test_short_building_ignored(self):
        """Buildings shorter than observer height are ignored."""
        buildings = [{
            "geom_wkt": "POLYGON((2.352 48.856, 2.353 48.856, 2.353 48.857, 2.352 48.857, 2.352 48.856))",
            "hauteur": 1.0,  # Below 1.5m observer
            "altitude_sol": 0,
        }]
        profile = compute_horizon_profile_sync(buildings, 48.8566, 2.3522)
        assert all(v == 0.0 for v in profile)

    def test_tall_building_creates_obstacle(self):
        """A tall building nearby should create non-zero profile values."""
        # Building ~50m north of observer
        buildings = [{
            "geom_wkt": "POLYGON((2.3518 48.8570, 2.3522 48.8570, 2.3522 48.8572, 2.3518 48.8572, 2.3518 48.8570))",
            "hauteur": 20.0,
            "altitude_sol": 0,
        }]
        profile = compute_horizon_profile_sync(buildings, 48.8566, 2.3520)

        # Building is roughly north (~0°), so profile around north should be non-zero
        north_values = [profile[i] for i in range(350, 360)] + [profile[i] for i in range(0, 10)]
        assert max(north_values) > 5.0, f"Expected obstacle to the north, max was {max(north_values)}"

        # South should be clear
        south_values = [profile[i] for i in range(170, 190)]
        assert max(south_values) == 0.0, "No obstacle expected to the south"
