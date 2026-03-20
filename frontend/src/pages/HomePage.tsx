import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SearchBar from "../components/SearchBar";
import { track } from "../analytics";

export default function HomePage() {
  const navigate = useNavigate();
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const { t } = useTranslation();

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoError(t("geo.notSupported"));
      return;
    }

    setGeoLoading(true);
    setGeoError(null);
    track("geolocalisation_demandee");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        track("geolocalisation_accordee");
        setGeoLoading(false);
        navigate(`/nearby?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      },
      (err) => {
        track("geolocalisation_refusee", { code: err.code });
        setGeoLoading(false);
        setGeoError(
          err.code === 1
            ? t("geo.denied")
            : t("geo.unavailable"),
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mt-12 mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {t("home.subtitleSun")}
        </h2>
        <p className="text-gray-500">
          {t("app.tagline")}
        </p>
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <SearchBar />
        <button
          onClick={handleGeolocate}
          disabled={geoLoading}
          className="mt-3 w-full bg-amber-500 text-white py-3 rounded-lg font-medium hover:bg-amber-600 transition disabled:opacity-50"
        >
          {geoLoading ? t("home.locating") : t("home.aroundMe")}
        </button>
        {geoError && <p className="mt-2 text-sm text-red-500">{geoError}</p>}
      </div>
    </div>
  );
}
