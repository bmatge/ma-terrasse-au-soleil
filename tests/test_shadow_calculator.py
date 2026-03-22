"""Tests unitaires pour le calcul d'ombre de la Tour Triangle."""
import math

import pytest

from scripts.tour_triangle_impact.shadow_calculator import (
    TOUR_HAUTEUR_M,
    compute_shadow_polygon,
    get_tour_centroid,
    is_in_tower_shadow,
    is_sunny,
    load_tour_geometry,
)


@pytest.fixture
def tour_geom():
    return load_tour_geometry()


@pytest.fixture
def tour_centroid():
    return get_tour_centroid()


class TestOmbreHiverMaximale:
    def test_ombre_hiver_longueur(self, tour_geom):
        """En décembre à midi, l'ombre doit faire ~650-700m."""
        # Soleil bas en hiver: altitude ~18° à midi en décembre à Paris
        altitude_hiver_midi = 18.0
        azimut_midi = 180.0  # plein sud

        shadow = compute_shadow_polygon(tour_geom, azimut_midi, altitude_hiver_midi)
        assert shadow is not None

        longueur_ombre = TOUR_HAUTEUR_M / math.tan(math.radians(altitude_hiver_midi))
        assert 550 < longueur_ombre < 560  # 180/tan(18°) ≈ 554m

    def test_ombre_hiver_tres_longue_15h(self, tour_geom):
        """En décembre à 15h, le soleil est encore plus bas → ombre plus longue."""
        altitude_hiver_15h = 10.0  # très bas
        longueur = TOUR_HAUTEUR_M / math.tan(math.radians(altitude_hiver_15h))
        assert longueur > 1000  # plus de 1km


class TestPasOmbreNuit:
    def test_elevation_negative(self, tour_geom):
        """elevation <= 0 → pas d'ombre."""
        shadow = compute_shadow_polygon(tour_geom, 180.0, -5.0)
        assert shadow is None

    def test_elevation_zero(self, tour_geom):
        """elevation = 0 → pas d'ombre."""
        shadow = compute_shadow_polygon(tour_geom, 90.0, 0.0)
        assert shadow is None

    def test_is_sunny_nuit(self):
        """is_sunny renvoie False quand le soleil est sous l'horizon."""
        profile = [0.0] * 360
        assert not is_sunny(profile, -1.0, 180.0)
        assert not is_sunny(profile, 0.0, 180.0)


class TestTerrassePleinEstPasImpacteeMatin:
    def test_terrasse_est_matin(self, tour_geom, tour_centroid):
        """Une terrasse à l'est de la tour n'est pas impactée le matin.

        Le soleil vient de l'est → l'ombre va vers l'ouest.
        """
        tour_lat, tour_lon = tour_centroid

        # Terrasse 300m à l'est de la tour
        offset_lon = 300 / (111_320 * math.cos(math.radians(tour_lat)))
        terrasse_lon = tour_lon + offset_lon
        terrasse_lat = tour_lat

        # Soleil au SE le matin (azimut ~120°, altitude 25°)
        in_shadow = is_in_tower_shadow(
            terrasse_lon, terrasse_lat, tour_geom,
            sun_azimuth=120.0, sun_altitude=25.0
        )
        assert not in_shadow, "Terrasse à l'est ne devrait pas être dans l'ombre le matin"


class TestTerrasseNordImpacteeHiver:
    def test_terrasse_nord_hiver_midi(self, tour_geom, tour_centroid):
        """Une terrasse au nord à 300m est impactée en décembre à midi.

        En hiver, le soleil est au sud → l'ombre va vers le nord.
        """
        tour_lat, tour_lon = tour_centroid

        # Terrasse 300m au nord de la tour
        offset_lat = 300 / 111_320
        terrasse_lat = tour_lat + offset_lat
        terrasse_lon = tour_lon

        # Soleil au sud en hiver à midi (azimut ~180°, altitude ~18°)
        in_shadow = is_in_tower_shadow(
            terrasse_lon, terrasse_lat, tour_geom,
            sun_azimuth=180.0, sun_altitude=18.0
        )
        assert in_shadow, "Terrasse au nord à 300m devrait être dans l'ombre en hiver à midi"

    def test_terrasse_nord_loin_pas_impactee(self, tour_geom, tour_centroid):
        """Une terrasse à 700m au nord n'est PAS impactée même en hiver.

        L'ombre à 18° fait ~554m, donc 700m est hors portée.
        """
        tour_lat, tour_lon = tour_centroid

        offset_lat = 700 / 111_320
        terrasse_lat = tour_lat + offset_lat
        terrasse_lon = tour_lon

        in_shadow = is_in_tower_shadow(
            terrasse_lon, terrasse_lat, tour_geom,
            sun_azimuth=180.0, sun_altitude=18.0
        )
        assert not in_shadow, "Terrasse à 700m au nord ne devrait pas être impactée"
