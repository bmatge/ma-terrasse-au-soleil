import { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { NearbyTerrasse } from "../api/types";

const STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

const STATUS_MARKER_COLORS: Record<string, string> = {
  soleil: "#f59e0b",
  mitige: "#eab308",
  couvert: "#9ca3af",
  ombre: "#6b7280",
  nuit: "#334155",
};

interface MapProps {
  center: [number, number]; // [lon, lat]
  terrasses: NearbyTerrasse[];
  onTerrasseClick?: (id: number) => void;
}

export default function Map({ center, terrasses, onTerrasseClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: center,
      zoom: 15,
      attributionControl: {},
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center
  useEffect(() => {
    mapRef.current?.flyTo({ center, zoom: 15 });
  }, [center]);

  const handleClick = useCallback(
    (id: number) => {
      onTerrasseClick?.(id);
    },
    [onTerrasseClick],
  );

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add user position marker
    new maplibregl.Marker({ color: "#3b82f6" })
      .setLngLat(center)
      .setPopup(new maplibregl.Popup().setText("Votre position"))
      .addTo(map);

    // Add terrace markers
    terrasses.forEach((t) => {
      const color = STATUS_MARKER_COLORS[t.status] || "#6b7280";

      const el = document.createElement("div");
      el.className = "terrace-marker";
      el.style.cssText = `
        width: 14px; height: 14px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;

      const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
        <div style="font-size:13px">
          <strong>${t.nom}</strong><br/>
          <span>${t.distance_m}m</span>
          ${t.soleil_jusqua ? `<br/><span style="color:#d97706">Soleil jusqu'à ${t.soleil_jusqua}</span>` : ""}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([t.lon, t.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => handleClick(t.id));
      markersRef.current.push(marker);
    });
  }, [terrasses, center, handleClick]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-gray-200"
      style={{ height: "400px" }}
    />
  );
}
