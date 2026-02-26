import { useRef, useEffect, useMemo } from "react";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cspWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import SunCalc from "suncalc";

setWorkerUrl(cspWorkerUrl);

const STYLE_URL = "/tiles/styles/liberty";
const TILE_ORIGIN = "https://tiles.openfreemap.org/";

interface SunMapProps {
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD
  /** Currently selected time slot, e.g. "14:00" */
  selectedTime: string | null;
}

/** Compute a destination point given a start, bearing (degrees) and distance (meters). */
function destinationPoint(
  lat: number,
  lon: number,
  bearing: number,
  distanceM: number,
): [number, number] {
  const R = 6371000;
  const d = distanceM / R;
  const brng = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export default function SunMap({
  lat,
  lon,
  date,
  selectedTime,
}: SunMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const sunPos = useMemo(() => {
    if (!selectedTime) return null;
    const dt = new Date(`${date}T${selectedTime}:00`);
    // Ensure valid date
    if (isNaN(dt.getTime())) return null;
    // suncalc expects date, lat, lon
    const pos = SunCalc.getPosition(dt, lat, lon);
    // pos.azimuth is in radians, measured from south, clockwise
    // Convert to degrees from north
    const azimuthDeg = ((pos.azimuth * 180) / Math.PI + 180) % 360;
    const altitudeDeg = (pos.altitude * 180) / Math.PI;
    return { azimuth: azimuthDeg, altitude: altitudeDeg };
  }, [lat, lon, date, selectedTime]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [lon, lat],
      zoom: 17,
      interactive: false, // static map
      attributionControl: false,
      transformRequest: (url: string) => {
        if (url.startsWith(TILE_ORIGIN)) {
          return { url: url.replace(TILE_ORIGIN, "/tiles/") };
        }
        return { url };
      },
    });

    mapRef.current = map;

    // Add terrasse marker
    const el = document.createElement("div");
    el.style.cssText = `
      width: 12px; height: 12px;
      background: #f59e0b;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    `;
    new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);

    map.on("load", () => {
      // Sun direction line source (empty, updated by next effect)
      map.addSource("sun-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sun-line-layer",
        type: "line",
        source: "sun-line",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });
      // Sun icon point
      map.addSource("sun-icon", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sun-icon-layer",
        type: "symbol",
        source: "sun-icon",
        layout: {
          "text-field": "☀️",
          "text-size": 20,
          "text-allow-overlap": true,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update sun direction line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const src = map.getSource("sun-line") as maplibregl.GeoJSONSource | undefined;
    const iconSrc = map.getSource("sun-icon") as maplibregl.GeoJSONSource | undefined;

    if (!sunPos || sunPos.altitude <= 0) {
      // Sun below horizon — hide line
      src?.setData({ type: "FeatureCollection", features: [] });
      iconSrc?.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const endPoint = destinationPoint(lat, lon, sunPos.azimuth, 120);

    src?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, lat],
          endPoint,
        ],
      },
    });

    iconSrc?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: endPoint,
      },
    });
  }, [sunPos, lat, lon]);

  // Retry updating sun line once the style loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      // Re-trigger the sun line update by dispatching a state-like check
      const src = map.getSource("sun-line") as maplibregl.GeoJSONSource | undefined;
      const iconSrc = map.getSource("sun-icon") as maplibregl.GeoJSONSource | undefined;
      if (!src || !iconSrc) return;
      if (!sunPos || sunPos.altitude <= 0) {
        src.setData({ type: "FeatureCollection", features: [] });
        iconSrc.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      const endPoint = destinationPoint(lat, lon, sunPos.azimuth, 120);
      src.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [[lon, lat], endPoint],
        },
      });
      iconSrc.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: endPoint,
        },
      });
    };
    map.on("styledata", handler);
    return () => { map.off("styledata", handler); };
  }, [sunPos, lat, lon]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ height: "200px" }}
      />
      {sunPos && sunPos.altitude > 0 && (
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-gray-600 shadow">
          ☀️ {Math.round(sunPos.altitude)}° d'élévation
        </div>
      )}
      {sunPos && sunPos.altitude <= 0 && selectedTime && (
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-gray-500 shadow">
          🌙 Soleil couché
        </div>
      )}
    </div>
  );
}
