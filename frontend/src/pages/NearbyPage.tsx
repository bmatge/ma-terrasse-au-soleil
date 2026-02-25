import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getNearby } from "../api/terrasses";
import Map from "../components/Map";
import TerrasseCard from "../components/TerrasseCard";
import TimeSlider from "../components/TimeSlider";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const lat = Number(searchParams.get("lat") || "48.8566");
  const lon = Number(searchParams.get("lon") || "2.3522");

  const [time, setTime] = useState(currentTime);

  const datetimeStr = useMemo(() => `${todayDate()}T${time}:00`, [time]);

  const { data, isLoading } = useQuery({
    queryKey: ["nearby", lat, lon, datetimeStr],
    queryFn: () => getNearby(lat, lon, datetimeStr),
  });

  const center = useMemo((): [number, number] => [lon, lat], [lon, lat]);

  function handleTerrasseClick(id: number) {
    navigate(`/terrasse/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <a href="/" className="text-amber-600 hover:underline text-sm">
          &larr; Retour
        </a>
        <h2 className="text-xl font-bold text-gray-800 mt-1">
          Terrasses au soleil
        </h2>
        {data?.meteo && (
          <p className="text-sm text-gray-500">
            {data.meteo.status === "degage"
              ? "Ciel d\u00e9gag\u00e9"
              : data.meteo.status === "mitige"
                ? "\u00c9claircies"
                : "Ciel couvert"}{" "}
            &mdash; {data.meteo.cloud_cover}% de nuages
          </p>
        )}
      </div>

      {/* Time slider */}
      <TimeSlider value={time} onChange={setTime} />

      {/* Map */}
      <Map
        center={center}
        terrasses={data?.terrasses || []}
        onTerrasseClick={handleTerrasseClick}
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
          {data?.terrasses.map((t) => (
            <TerrasseCard key={t.id} terrasse={t} />
          ))}
          {data?.terrasses.length === 0 && (
            <p className="text-center text-gray-400 py-8">
              Aucune terrasse trouv&eacute;e dans ce p&eacute;rim&egrave;tre
            </p>
          )}
        </div>
      )}
    </div>
  );
}
