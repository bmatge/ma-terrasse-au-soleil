import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cspWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import type { NearbyTerrasse } from "../api/types";

setWorkerUrl(cspWorkerUrl);
import type { Mode } from "../contexts/ThemeContext";
import { themes } from "../contexts/ThemeContext";
import { F, STATUS_CONFIG, STYLE_URL, TILE_ORIGIN } from "../lib/constants";

interface ResultsMapProps {
  terrasses: NearbyTerrasse[];
  mode: Mode;
  onTerrasseClick: (t: NearbyTerrasse) => void;
  onCenterChange?: (lat: number, lon: number) => void;
}

export default function ResultsMap({
  terrasses,
  mode,
  onTerrasseClick,
  onCenterChange,
}: ResultsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onClickRef = useRef(onTerrasseClick);
  onClickRef.current = onTerrasseClick;
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const initialFitRef = useRef(false);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [is3D, setIs3D] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const avgLat = terrasses.reduce((s, c) => s + c.lat, 0) / (terrasses.length || 1);
    const avgLon = terrasses.reduce((s, c) => s + c.lon, 0) / (terrasses.length || 1);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [avgLon || 2.3522, avgLat || 48.8566],
      zoom: 14,
      attributionControl: {},
      transformRequest: (url: string) => {
        if (url.startsWith(TILE_ORIGIN)) return { url: url.replace(TILE_ORIGIN, "/tiles/") };
        return { url };
      },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Update search center when user pans/zooms (ignore programmatic moves)
    map.on("moveend", (e) => {
      if (!e.originalEvent) return;
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        const c = map.getCenter();
        onCenterChangeRef.current?.(c.lat, c.lng);
      }, 400);
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; initialFitRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    terrasses.forEach((terrasse) => {
      const cfg = STATUS_CONFIG[terrasse.status] || STATUS_CONFIG.ombre;
      const el = document.createElement("div");
      el.style.cssText = `width:14px;height:14px;background:${cfg.color};border:2px solid white;border-radius:50%;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);`;
      const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
        <div style="font-size:13px;font-family:${F}">
          <strong>${terrasse.nom_commercial || terrasse.nom}</strong><br/>
          <span style="color:#78716C">${terrasse.distance_m}m</span>
          ${terrasse.soleil_jusqua ? `<br/><span style="color:#D97706">\u2600\uFE0F ${terrasse.soleil_jusqua}</span>` : ""}
        </div>
      `);
      const marker = new maplibregl.Marker({ element: el }).setLngLat([terrasse.lon, terrasse.lat]).setPopup(popup).addTo(map);
      el.addEventListener("click", () => onClickRef.current(terrasse));
      markersRef.current.push(marker);
    });
    // Only auto-fit on the first load; after user pans we keep their viewport
    if (!initialFitRef.current && terrasses.length > 0) {
      initialFitRef.current = true;
      if (terrasses.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        terrasses.forEach((t) => bounds.extend([t.lon, t.lat]));
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      } else {
        map.flyTo({ center: [terrasses[0].lon, terrasses[0].lat], zoom: 15 });
      }
    }
  }, [terrasses, mode]);

  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    if (next) {
      map.easeTo({ pitch: 50, bearing: -20, duration: 600 });
      const onReady = () => {
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
            "fill-extrusion-opacity": 0.8,
          },
        }, firstSymbol);
      };
      map.isStyleLoaded() ? onReady() : map.once("styledata", onReady);
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      if (map.getLayer("buildings-3d")) map.removeLayer("buildings-3d");
    }
  }, [is3D]);

  const th = themes[mode];
  return (
    <div style={{ position: "relative", width: "100%", height: "min(50vh, 500px)", borderRadius: 14, overflow: "hidden", border: `1px solid ${th.border}` }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <button
        onClick={toggle3D}
        style={{
          position: "absolute", bottom: 10, left: 10, zIndex: 1,
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
