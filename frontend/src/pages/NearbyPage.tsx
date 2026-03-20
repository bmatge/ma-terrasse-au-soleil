import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getNearby } from "../api/terrasses";
import Map from "../components/Map";
import TerrasseCard from "../components/TerrasseCard";
import TimeSlider from "../components/TimeSlider";
import UvBadge from "../components/UvBadge";
import { TYPE_CONFIG } from "../components/PlaceTypeBadge";
import { normalizePlaceType } from "../utils/placeType";
import { track } from "../analytics";

function currentTime(): string {
  const now = new Date();
  const minutes = now.getHours() * 60 + Math.floor(now.getMinutes() / 15) * 15;
  const clamped = Math.max(7 * 60, Math.min(22 * 60, minutes));
  const h = Math.floor(clamped / 60).toString().padStart(2, "0");
  const m = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function NearbyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const initialLat = Number(searchParams.get("lat") || "48.8566");
  const initialLon = Number(searchParams.get("lon") || "2.3522");

  // mapCenter tracks the current map center (updated on pan/zoom)
  const [mapCenter, setMapCenter] = useState<[number, number]>([initialLon, initialLat]);
  const [time, setTime] = useState(currentTime);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const lat = mapCenter[1];
  const lon = mapCenter[0];

  // Round to 4 decimals (~11m) to avoid re-fetching on tiny floating-point drift
  const queryLat = Math.round(lat * 10000) / 10000;
  const queryLon = Math.round(lon * 10000) / 10000;

  const datetimeStr = useMemo(() => `${todayDate()}T${time}:00`, [time]);

  const { data, isLoading } = useQuery({
    queryKey: ["nearby", queryLat, queryLon, datetimeStr],
    queryFn: () => getNearby(lat, lon, datetimeStr),
  });

  // Derive available types from results for filter chips
  const availableTypes = useMemo(() => {
    if (!data?.terrasses) return [];
    const counts: Record<string, number> = {};
    for (const t of data.terrasses) {
      const cat = normalizePlaceType(t.place_type);
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [data?.terrasses]);

  const filteredTerrasses = useMemo(() => {
    if (!data?.terrasses) return [];
    if (!typeFilter) return data.terrasses;
    return data.terrasses.filter((t) => normalizePlaceType(t.place_type) === typeFilter);
  }, [data?.terrasses, typeFilter]);

  const center = useMemo((): [number, number] => [initialLon, initialLat], [initialLon, initialLat]);

  const handleMapMoveEnd = useCallback(
    (newCenter: [number, number]) => {
      setMapCenter(newCenter);
      // Update URL for shareability (replace to avoid polluting history)
      setSearchParams(
        { lat: newCenter[1].toFixed(6), lon: newCenter[0].toFixed(6) },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  function handleTerrasseClick(id: number) {
    track("terrasse_vue", { id, source: "carte" });
    navigate(`/terrasse/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <a href="/" className="text-amber-600 hover:underline text-sm">
          &larr; {t("common.back")}
        </a>
        <h2 className="text-xl font-bold text-gray-800 mt-1">
          {t("results.sunTerraces")}
        </h2>
        {data?.meteo && (
          <p className="text-sm text-gray-500">
            {data.meteo.status === "degage"
              ? t("weather.clearSky")
              : data.meteo.status === "mitige"
                ? t("weather.partlyCloudy")
                : t("weather.overcast")}{" "}
            &mdash; {data.meteo.cloud_cover}% {t("weather.clouds")}
          </p>
        )}
      </div>

      {/* Time slider */}
      <TimeSlider value={time} onChange={setTime} />

      {/* UV index */}
      {data?.meteo && data.meteo.uv_index > 0 && (
        <div className="flex items-center gap-2">
          <UvBadge uvIndex={data.meteo.uv_index} />
        </div>
      )}

      {/* Type filter */}
      {availableTypes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setTypeFilter(null)}
            className={`shrink-0 text-sm px-3 py-1.5 rounded-full border transition ${
              typeFilter === null
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
            }`}
          >
            {t("results.all")}
          </button>
          {availableTypes.map(({ type, count }) => {
            const config = TYPE_CONFIG[type];
            const label = config ? t(config.labelKey) : type.replace(/_/g, " ");
            const icon = config?.icon ?? "\uD83C\uDFE0";
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                className={`shrink-0 text-sm px-3 py-1.5 rounded-full border transition ${
                  typeFilter === type
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
                }`}
              >
                {icon} {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      <Map
        center={center}
        terrasses={filteredTerrasses}
        onTerrasseClick={handleTerrasseClick}
        onMoveEnd={handleMapMoveEnd}
      />

      {/* Terrace list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTerrasses.map((t) => (
            <TerrasseCard key={t.id} terrasse={t} />
          ))}
          {filteredTerrasses.length === 0 && (
            <p className="text-center text-gray-400 py-8">
              {t("weather.noTerraces")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
