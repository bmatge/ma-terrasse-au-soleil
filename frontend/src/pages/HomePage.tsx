import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";

export default function HomePage() {
  const navigate = useNavigate();
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoError("Géolocalisation non supportée par votre navigateur");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        navigate(`/nearby?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(
          err.code === 1
            ? "Permission de géolocalisation refusée"
            : "Impossible d'obtenir votre position",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mt-12 mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Trouve ta terrasse au soleil
        </h2>
        <p className="text-gray-500">
          Paris intra-muros &mdash; ensoleillement + m&eacute;t&eacute;o en temps r&eacute;el
        </p>
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <SearchBar />
        <button
          onClick={handleGeolocate}
          disabled={geoLoading}
          className="mt-3 w-full bg-amber-500 text-white py-3 rounded-lg font-medium hover:bg-amber-600 transition disabled:opacity-50"
        >
          {geoLoading ? "Localisation..." : "Autour de moi"}
        </button>
        {geoError && <p className="mt-2 text-sm text-red-500">{geoError}</p>}
      </div>
    </div>
  );
}
