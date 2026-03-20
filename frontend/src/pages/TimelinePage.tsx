import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getTimeline } from "../api/terrasses";
import Timeline from "../components/Timeline";
import SunMap from "../components/SunMap";
import PriceLevel from "../components/PriceLevel";
import PlaceTypeBadge from "../components/PlaceTypeBadge";
import Rating from "../components/Rating";
import { track } from "../analytics";

function currentTimeRounded(): string {
  const now = new Date();
  const minutes = now.getHours() * 60 + Math.floor(now.getMinutes() / 15) * 15;
  const clamped = Math.max(7 * 60, Math.min(22 * 60, minutes));
  const h = Math.floor(clamped / 60).toString().padStart(2, "0");
  const m = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date") || undefined;
  const [selectedTime, setSelectedTime] = useState<string>(currentTimeRounded);

  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline", id, dateParam],
    queryFn: () => getTimeline(Number(id), dateParam),
    enabled: !!id,
  });

  function changeDate(offset: number) {
    const current = dateParam ? new Date(dateParam) : new Date();
    current.setDate(current.getDate() + offset);
    const newDate = current.toISOString().split("T")[0];
    track("date_changee", { offset, date: newDate });
    setSearchParams({ date: newDate });
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-red-500">Erreur lors du chargement de la timeline.</p>
        <Link to="/" className="text-amber-600 underline">Retour</Link>
      </div>
    );
  }

  const displayDate = new Date(data.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link to="/" className="text-amber-600 hover:underline text-sm">
          &larr; Retour
        </Link>
        <div className="flex items-center gap-3 mt-2">
          {data.terrasse.place_type && (
            <PlaceTypeBadge type={data.terrasse.place_type} className="text-sm px-2.5 py-1" />
          )}
          <h2 className="text-2xl font-bold text-gray-800">
            {data.terrasse.nom_commercial || data.terrasse.nom}
          </h2>
        </div>
        <p className="text-gray-500">{data.terrasse.adresse}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {data.terrasse.price_level != null && data.terrasse.price_level > 0 && (
            <PriceLevel level={data.terrasse.price_level} />
          )}
          {data.terrasse.rating != null && (
            <Rating rating={data.terrasse.rating} count={data.terrasse.user_rating_count} />
          )}
        </div>
        {(data.terrasse.phone || data.terrasse.website || data.terrasse.google_maps_uri) && (
          <div className="flex items-center gap-3 mt-2 text-sm">
            {data.terrasse.phone && (
              <a href={`tel:${data.terrasse.phone}`} className="text-amber-600 hover:underline">
                {data.terrasse.phone}
              </a>
            )}
            {data.terrasse.website && (
              <a href={data.terrasse.website} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
                Site web
              </a>
            )}
            {data.terrasse.google_maps_uri && (
              <a href={data.terrasse.google_maps_uri} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
                Google Maps
              </a>
            )}
          </div>
        )}
      </div>

      {/* Date selector */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeDate(-1)}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          &larr; Veille
        </button>
        <span className="font-medium text-gray-700 capitalize">{displayDate}</span>
        <button
          onClick={() => changeDate(1)}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Lendemain &rarr;
        </button>
      </div>

      {/* Sun direction map */}
      <div className="mb-4">
        <SunMap
          lat={data.terrasse.lat}
          lon={data.terrasse.lon}
          date={data.date}
          selectedTime={selectedTime}
        />
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow p-4">
        <Timeline
          slots={data.slots}
          bestWindow={data.meilleur_creneau}
          meteoResume={data.meteo_resume}
          onSlotHover={setSelectedTime}
        />
      </div>
    </div>
  );
}
