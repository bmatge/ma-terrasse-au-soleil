import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cspWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import { useTheme } from "../contexts/ThemeContext";
import { F, STYLE_URL, TILE_ORIGIN } from "../lib/constants";
import { destinationPoint } from "../lib/helpers";

setWorkerUrl(cspWorkerUrl);

interface SunMapProps {
  lat: number;
  lon: number;
  sunAltitude: number | null;
  sunAzimuth: number | null;
}

export default function SunMap({ lat, lon, sunAltitude, sunAzimuth }: SunMapProps) {
  const { th } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [is3D, setIs3D] = useState(true);

  const sunPos = useMemo(() => {
    if (sunAltitude == null || sunAzimuth == null) return null;
    return { azimuth: sunAzimuth, altitude: sunAltitude };
  }, [sunAltitude, sunAzimuth]);

  const add3DBuildings = useCallback((map: maplibregl.Map) => {
    if (map.getLayer("buildings-3d")) return;
    const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    map.addLayer({
      id: "buildings-3d",
      source: "openmaptiles",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#d8d0c8",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 10],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    }, firstSymbol);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [lon, lat],
      zoom: 17,
      pitch: 50,
      bearing: 0,
      attributionControl: false,
      transformRequest: (url: string) => {
        if (url.startsWith(TILE_ORIGIN)) return { url: url.replace(TILE_ORIGIN, "/tiles/") };
        return { url };
      },
    });
    mapRef.current = map;
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.dragPan.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    const el = document.createElement("div");
    el.style.cssText = `width:12px;height:12px;background:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);`;
    new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
    map.on("load", () => {
      add3DBuildings(map);
      map.addSource("sun-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "sun-line-layer", type: "line", source: "sun-line", paint: { "line-color": "#f59e0b", "line-width": 3, "line-dasharray": [2, 2] } });
      map.addSource("sun-icon", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "sun-icon-layer", type: "symbol", source: "sun-icon", layout: { "text-field": "\u2600\uFE0F", "text-size": 20, "text-allow-overlap": true } });
    });
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    if (next) {
      map.easeTo({ pitch: 50, bearing: 0, duration: 600 });
      map.isStyleLoaded() ? add3DBuildings(map) : map.once("styledata", () => add3DBuildings(map));
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      if (map.getLayer("buildings-3d")) map.removeLayer("buildings-3d");
    }
  }, [is3D, add3DBuildings]);

  const updateSunLine = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("sun-line") as maplibregl.GeoJSONSource | undefined;
    const iconSrc = map.getSource("sun-icon") as maplibregl.GeoJSONSource | undefined;
    if (!src || !iconSrc) return;
    if (!sunPos || sunPos.altitude <= 0) {
      src.setData({ type: "FeatureCollection", features: [] });
      iconSrc.setData({ type: "FeatureCollection", features: [] });
      map.jumpTo({ bearing: 0, pitch: 50 });
      return;
    }
    const bearing = (sunPos.azimuth + 180) % 360;
    const pitch = Math.min(70, Math.max(15, 90 - sunPos.altitude));
    map.jumpTo({ bearing, pitch });
    const endPoint = destinationPoint(lat, lon, sunPos.azimuth, 120);
    src.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lon, lat], endPoint] } });
    iconSrc.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: endPoint } });
  }, [sunPos, lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateSunLine();
  }, [updateSunLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("styledata", updateSunLine);
    return () => { map.off("styledata", updateSunLine); };
  }, [updateSunLine]);

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <div ref={containerRef} style={{ width: "100%", height: 200, borderRadius: 14, overflow: "hidden", border: `1px solid ${th.border}` }} />
      {sunPos && sunPos.altitude > 0 && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: th.textSoft, boxShadow: `0 1px 4px ${th.shadow}` }}>
          ☀️ {Math.round(sunPos.altitude)}° d'élévation
        </div>
      )}
      {sunPos && sunPos.altitude <= 0 && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: th.textMuted, boxShadow: `0 1px 4px ${th.shadow}` }}>
          🌙 Soleil couché
        </div>
      )}
      <button
        onClick={toggle3D}
        style={{
          position: "absolute", bottom: 8, right: 8,
          padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
          background: is3D ? th.accent : "rgba(255,255,255,0.92)",
          color: is3D ? "#FFF" : th.textSoft,
          fontSize: 12, fontWeight: 700, fontFamily: F,
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >{is3D ? "2D" : "3D"}</button>
    </div>
  );
}
