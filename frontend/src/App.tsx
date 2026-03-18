import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cspWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import SunCalc from "suncalc";
import {
  getNearby,
  getTimeline,
  searchTerrasses as searchTerrassesApi,
  geocode as geocodeApi,
} from "./api/terrasses";
import type {
  NearbyTerrasse,
  TerrasseSearchResult,
  GeocodeResult,
  TimelineSlot,
} from "./api/types";
import { useDebounce } from "./hooks/useDebounce";

setWorkerUrl(cspWorkerUrl);


// ─── Types ───
interface FavTerrasse {
  id: number;
  nom: string;
  adresse: string | null;
}

type Page = "home" | "search" | "results" | "detail" | "favorites" | "about" | "contact";
type Mode = "sun" | "shade";
type ViewMode = "list" | "map";
type SearchType = "address" | "terrasse" | "metro";

// ─── Constants ───
const HOURS = [
  "09:00","10:00","11:00","12:00","13:00","14:00",
  "15:00","16:00","17:00","18:00","19:00",
];
const F = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const STYLE_URL = "/tiles/styles/bright";
const TILE_ORIGIN = "https://tiles.openfreemap.org/";

const METRO_STATIONS = [
  "Abbesses","Alésia","Alexandre Dumas","Alma-Marceau","Anvers","Arts et Métiers",
  "Assemblée Nationale","Avron","Bastille","Bel-Air","Belleville","Bercy",
  "Bir-Hakeim","Blanche","Bolivar","Bonne Nouvelle","Botzaris","Boucicaut",
  "Bourse","Brochant","Buttes Chaumont","Cadet","Cambronne","Campo-Formio",
  "Cardinal Lemoine","Censier-Daubenton","Chardon-Lagache","Charonne","Château d'Eau",
  "Château Rouge","Châtelet","Chemin Vert","Chevaleret","Cité","Cluny-La Sorbonne",
  "Colonel Fabien","Commerce","Convention","Corvisart","Couronnes","Courcelles",
  "Daumesnil","Denfert-Rochereau","Dugommier","Dupleix","Duroc","Edgar Quinet",
  "Étienne Marcel","Europe","Exelmans","Faidherbe-Chaligny","Falguière","Félix Faure",
  "Filles du Calvaire","Franklin D. Roosevelt","Gambetta","Gare d'Austerlitz",
  "Gare de l'Est","Gare de Lyon","Gare du Nord","George V","Glacière",
  "Goncourt","Grands Boulevards","Guy Môquet","Havre-Caumartin","Hôtel de Ville",
  "Iéna","Invalides","Jacques Bonsergent","Jaurès","Jasmin","Jourdain","Jules Joffrin",
  "Jussieu","Kléber","La Chapelle","La Fourche","La Motte-Picquet-Grenelle",
  "La Muette","Lamarck-Caulaincourt","Laumière","Ledru-Rollin","Lourmel",
  "Luxembourg","Madeleine","Mairie du 18e","Maubert-Mutualité","Ménilmontant",
  "Michel-Ange-Auteuil","Mirabeau","Monceau","Montgallet","Montparnasse-Bienvenüe",
  "Mouton-Duvernet","Nation","Notre-Dame-de-Lorette","Oberkampf","Odéon","Opéra",
  "Ourcq","Passy","Pasteur","Pelleport","Père Lachaise","Pernety","Philippe Auguste",
  "Pigalle","Place d'Italie","Place de Clichy","Place des Fêtes","Place Monge",
  "Plaisance","Pont de l'Alma","Pont Marie","Pont Neuf","Pyramides",
  "Quai de la Rapée","Rambuteau","Ranelagh","Raspail","Réaumur-Sébastopol",
  "Rennes","République","Reuilly-Diderot","Richard-Lenoir","Richelieu-Drouot",
  "Riquet","Rome","Rue de la Pompe","Rue des Boulets","Rue du Bac",
  "Saint-Ambroise","Saint-Augustin","Saint-François-Xavier","Saint-Georges",
  "Saint-Germain-des-Prés","Saint-Jacques","Saint-Lazare","Saint-Marcel",
  "Saint-Maur","Saint-Michel","Saint-Paul","Saint-Philippe du Roule",
  "Saint-Placide","Saint-Sébastien-Froissart","Saint-Sulpice","Ségur","Sentier",
  "Sèvres-Babylone","Simplon","Solférino","Stalingrad","Strasbourg-Saint-Denis",
  "Télégraphe","Temple","Ternes","Tolbiac","Trinité-d'Estienne d'Orves",
  "Trocadéro","Tuileries","Vaneau","Varenne","Vavin","Victor Hugo","Villiers",
  "Volontaires","Voltaire",
].sort();

// Stations with coords for random KPI on home page
const KPI_STATIONS: { name: string; lat: number; lon: number }[] = [
  { name: "Bastille", lat: 48.8533, lon: 2.3692 },
  { name: "République", lat: 48.8675, lon: 2.3637 },
  { name: "Oberkampf", lat: 48.8649, lon: 2.3681 },
  { name: "Ledru-Rollin", lat: 48.8515, lon: 2.3767 },
  { name: "Nation", lat: 48.8485, lon: 2.3960 },
  { name: "Reuilly-Diderot", lat: 48.8474, lon: 2.3866 },
  { name: "Dupleix", lat: 48.8505, lon: 2.2937 },
  { name: "Odéon", lat: 48.8522, lon: 2.3387 },
  { name: "Gambetta", lat: 48.8653, lon: 2.3985 },
  { name: "Place d'Italie", lat: 48.8312, lon: 2.3555 },
  { name: "Belleville", lat: 48.8720, lon: 2.3766 },
  { name: "Arts et Métiers", lat: 48.8653, lon: 2.3562 },
  { name: "Saint-Paul", lat: 48.8552, lon: 2.3612 },
  { name: "Père Lachaise", lat: 48.8625, lon: 2.3867 },
  { name: "Censier-Daubenton", lat: 48.8408, lon: 2.3519 },
  { name: "Voltaire", lat: 48.8578, lon: 2.3804 },
  { name: "Bercy", lat: 48.8401, lon: 2.3796 },
  { name: "Ménilmontant", lat: 48.8669, lon: 2.3834 },
];

// Pick a random station once per session

// ─── Themes ───
const themes = {
  sun: {
    bg: "#FFFBF2", bgCard: "#FFFFFF", accent: "#F59E0B", accentLight: "#FEF3C7",
    accentDark: "#D97706", text: "#1C1917", textSoft: "#78716C", textMuted: "#A8A29E",
    border: "#F5F0E8", badge: "#FDE68A", badgeText: "#92400E",
    gradient: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
    shadow: "rgba(245,158,11,0.12)",
  },
  shade: {
    bg: "#F0F4F8", bgCard: "#FFFFFF", accent: "#3B82F6", accentLight: "#DBEAFE",
    accentDark: "#2563EB", text: "#1E293B", textSoft: "#64748B", textMuted: "#94A3B8",
    border: "#E2E8F0", badge: "#BFDBFE", badgeText: "#1E40AF",
    gradient: "linear-gradient(135deg, #BFDBFE 0%, #3B82F6 100%)",
    shadow: "rgba(59,130,246,0.12)",
  },
};

// ─── Status config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  soleil: { label: "Au soleil", color: "#D97706", icon: "sun" },
  mitige: { label: "Mitigé", color: "#CA8A04", icon: "sun" },
  couvert: { label: "Couvert", color: "#6B7280", icon: "shade" },
  ombre: { label: "À l'ombre", color: "#4B5563", icon: "shade" },
  ombre_batiment: { label: "À l'ombre", color: "#4B5563", icon: "shade" },
  nuit: { label: "Nuit", color: "#334155", icon: "shade" },
};

// ─── Icons ───
const SunIcon = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const ShadeIcon = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const HeartIcon = ({ filled, size = 20 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const BackIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const CrosshairIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="8" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const ListIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const MapPinIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const CoffeeIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string; }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
  </svg>
);

// ─── Helpers ───
function currentHourKey(): string {
  const h = Math.max(9, Math.min(19, new Date().getHours()));
  return `${h.toString().padStart(2, "0")}:00`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function loadFavorites(): FavTerrasse[] {
  try {
    return JSON.parse(localStorage.getItem("fav-terrasses") || "[]");
  } catch {
    return [];
  }
}

function isSunnyStatus(status: string): boolean {
  return status === "soleil" || status === "mitige";
}

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function parseCurrentUrl() {
  const path = window.location.pathname;
  const p = new URLSearchParams(window.location.search);
  return { path, p };
}

// ─── SunMap helpers ───
function destinationPoint(lat: number, lon: number, bearing: number, distanceM: number): [number, number] {
  const R = 6371000;
  const d = distanceM / R;
  const brng = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

// ─── SunMap Component ───
function SunMap({ lat, lon, date, selectedTime, theme }: { lat: number; lon: number; date: string; selectedTime: string; theme: typeof themes.sun }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [is3D, setIs3D] = useState(true);

  const sunPos = useMemo(() => {
    const dt = new Date(`${date}T${selectedTime}:00`);
    if (isNaN(dt.getTime())) return null;
    const pos = SunCalc.getPosition(dt, lat, lon);
    const azimuthDeg = ((pos.azimuth * 180) / Math.PI + 180) % 360;
    const altitudeDeg = (pos.altitude * 180) / Math.PI;
    return { azimuth: azimuthDeg, altitude: altitudeDeg };
  }, [lat, lon, date, selectedTime]);

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
      interactive: false,
      attributionControl: false,
      transformRequest: (url: string) => {
        if (url.startsWith(TILE_ORIGIN)) return { url: url.replace(TILE_ORIGIN, "/tiles/") };
        return { url };
      },
    });
    mapRef.current = map;
    const el = document.createElement("div");
    el.style.cssText = `width:12px;height:12px;background:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);`;
    new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
    map.on("load", () => {
      add3DBuildings(map);
      map.addSource("sun-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "sun-line-layer", type: "line", source: "sun-line", paint: { "line-color": "#f59e0b", "line-width": 3, "line-dasharray": [2, 2] } });
      map.addSource("sun-icon", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "sun-icon-layer", type: "symbol", source: "sun-icon", layout: { "text-field": "☀️", "text-size": 20, "text-allow-overlap": true } });
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
      return;
    }
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
      <div ref={containerRef} style={{ width: "100%", height: 200, borderRadius: 14, overflow: "hidden", border: `1px solid ${theme.border}` }} />
      {sunPos && sunPos.altitude > 0 && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: theme.textSoft, boxShadow: `0 1px 4px ${theme.shadow}` }}>
          ☀️ {Math.round(sunPos.altitude)}° d'élévation
        </div>
      )}
      {sunPos && sunPos.altitude <= 0 && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: theme.textMuted, boxShadow: `0 1px 4px ${theme.shadow}` }}>
          🌙 Soleil couché
        </div>
      )}
      <button
        onClick={toggle3D}
        style={{
          position: "absolute", bottom: 8, right: 8,
          padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
          background: is3D ? theme.accent : "rgba(255,255,255,0.92)",
          color: is3D ? "#FFF" : theme.textSoft,
          fontSize: 12, fontWeight: 700, fontFamily: F,
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >{is3D ? "2D" : "3D"}</button>
    </div>
  );
}

// ─── Results Map Component ───
function ResultsMap({
  terrasses,
  mode,
  onTerrasseClick,
  onCenterChange,
}: {
  terrasses: NearbyTerrasse[];
  mode: Mode;
  onTerrasseClick: (t: NearbyTerrasse) => void;
  onCenterChange?: (lat: number, lon: number) => void;
}) {
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
          <strong>${terrasse.nom}</strong><br/>
          <span style="color:#78716C">${terrasse.distance_m}m</span>
          ${terrasse.soleil_jusqua ? `<br/><span style="color:#D97706">Soleil jusqu'à ${terrasse.soleil_jusqua}</span>` : ""}
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

  const t = themes[mode];
  return (
    <div style={{ position: "relative", width: "100%", height: "min(50vh, 500px)", borderRadius: 14, overflow: "hidden", border: `1px solid ${t.border}` }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <button
        onClick={toggle3D}
        style={{
          position: "absolute", bottom: 10, left: 10, zIndex: 1,
          padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
          background: is3D ? t.accent : "rgba(255,255,255,0.92)",
          color: is3D ? "#FFF" : t.textSoft,
          fontSize: 12, fontWeight: 700, fontFamily: F,
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      >{is3D ? "2D" : "3D"}</button>
    </div>
  );
}

// ─── Contact Form ───
function ContactForm({ theme: t, fontFamily: F }: { theme: typeof themes.sun; fontFamily: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setName(""); setEmail(""); setMessage("");
    } catch {
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1.5px solid ${t.border}`, background: t.bg,
    fontFamily: F, fontSize: 14, color: t.text,
    outline: "none", boxSizing: "border-box",
  };

  if (status === "sent") return (
    <div style={{ textAlign: "center", padding: "16px 0", color: t.accentDark, fontFamily: F }}>
      ✅ Message envoyé, merci !
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input required placeholder="Ton prénom" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <input required type="email" placeholder="Ton email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <textarea required placeholder="Ton message..." value={message} onChange={e => setMessage(e.target.value)}
        rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      {status === "error" && <p style={{ fontFamily: F, fontSize: 13, color: "#EF4444", margin: 0 }}>Oups, une erreur s'est produite. Réessaie !</p>}
      <button type="submit" disabled={status === "sending"} style={{
        padding: "12px", borderRadius: 12, border: "none", cursor: status === "sending" ? "wait" : "pointer",
        background: t.gradient, color: "#FFF", fontSize: 15, fontWeight: 600, fontFamily: F,
        opacity: status === "sending" ? 0.7 : 1,
      }}>
        {status === "sending" ? "Envoi..." : "Envoyer 📨"}
      </button>
    </form>
  );
}

// ─── Main App ───
export default function App() {
  const [mode, setMode] = useState<Mode>("sun");
  const [page, setPage] = useState<Page>("home");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [kpiStationIndex, setKpiStationIndex] = useState(() => Math.floor(Math.random() * KPI_STATIONS.length));

  // Search state
  const [searchType, setSearchType] = useState<SearchType>("address");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedTerrasseId, setSelectedTerrasseId] = useState<number | null>(null);
  const [searchHour, setSearchHour] = useState(currentHourKey);
  const [searchDate, setSearchDate] = useState(todayISO()); // YYYY-MM-DD
  const [searchRadius, setSearchRadius] = useState(250);
  const [resultFilter, setResultFilter] = useState<"all" | "sun" | "shade">("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [shared, setShared] = useState(false);
  const [playEasterEgg, setPlayEasterEgg] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<FavTerrasse[]>(loadFavorites);
  useEffect(() => localStorage.setItem("fav-terrasses", JSON.stringify(favorites)), [favorites]);

  const t = themes[mode];
  const debouncedQuery = useDebounce(searchQuery, 300);

  // ─── API queries ───
  const { data: terrasseResults } = useQuery({
    queryKey: ["search-terrasses", debouncedQuery],
    queryFn: () => searchTerrassesApi(debouncedQuery),
    enabled: searchType === "terrasse" && debouncedQuery.length >= 2,
  });

  const { data: addressResults } = useQuery({
    queryKey: ["geocode", debouncedQuery],
    queryFn: () => geocodeApi(debouncedQuery),
    enabled: searchType === "address" && debouncedQuery.length >= 3,
  });

  // Metro filtering (client-side)
  const filteredMetro = useMemo(() => {
    if (searchType !== "metro" || !searchQuery) return METRO_STATIONS.slice(0, 10);
    const q = normalize(searchQuery);
    return METRO_STATIONS.filter((s) => normalize(s).includes(q)).slice(0, 10);
  }, [searchType, searchQuery]);

  const datetime = useMemo(() => {
    const hour = searchHour || currentHourKey();
    return `${searchDate}T${hour}:00`;
  }, [searchHour, searchDate]);

  const { data: nearbyData, isLoading: nearbyLoading, isError: nearbyError } = useQuery({
    queryKey: ["nearby", searchCoords?.lat, searchCoords?.lon, datetime, searchRadius],
    queryFn: () => getNearby(searchCoords!.lat, searchCoords!.lon, datetime, searchRadius),
    enabled: !!searchCoords,
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["timeline", selectedTerrasseId, searchDate],
    queryFn: () => getTimeline(selectedTerrasseId!, searchDate),
    enabled: !!selectedTerrasseId,
  });

  // Home KPIs — navigable metro station
  const kpiStation = KPI_STATIONS[kpiStationIndex];
  const { data: homeData } = useQuery({
    queryKey: ["home-nearby", kpiStation.name, todayISO(), currentHourKey()],
    queryFn: () => getNearby(kpiStation.lat, kpiStation.lon, `${todayISO()}T${currentHourKey()}:00`, 500),
    staleTime: 5 * 60 * 1000,
  });

  // ─── Derived data ───
  const results = useMemo(() => {
    if (!nearbyData) return [];
    return [...nearbyData.terrasses].sort((a, b) => {
      const aMatch = mode === "sun" ? isSunnyStatus(a.status) : !isSunnyStatus(a.status);
      const bMatch = mode === "sun" ? isSunnyStatus(b.status) : !isSunnyStatus(b.status);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.distance_m - b.distance_m;
    });
  }, [nearbyData, mode]);

  const kpi = useMemo(() => {
    const hour = currentHourKey();
    const station = kpiStation.name;
    if (!homeData) return { sunCount: "...", shadeCount: "...", hour, station };
    const sunCount = homeData.terrasses.filter((tr) => isSunnyStatus(tr.status)).length;
    const shadeCount = homeData.terrasses.length - sunCount;
    return { sunCount, shadeCount, hour, station };
  }, [homeData]);

  const hourlyFromTimeline = useMemo(() => {
    if (!timelineData) return {};
    const map: Record<string, TimelineSlot> = {};
    for (const slot of timelineData.slots) {
      const hourKey = slot.time.split(":")[0] + ":00";
      if (!map[hourKey] || slot.time.endsWith(":00")) {
        map[hourKey] = slot;
      }
    }
    return map;
  }, [timelineData]);

  // ─── Actions ───
  const toggleFav = useCallback((terrasse: { id: number; nom: string; adresse: string | null }) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === terrasse.id);
      if (exists) return prev.filter((f) => f.id !== terrasse.id);
      return [...prev, { id: terrasse.id, nom: terrasse.nom, adresse: terrasse.adresse }];
    });
  }, []);

  const isFav = useCallback((id: number) => favorites.some((f) => f.id === id), [favorites]);

  const navigate = useCallback((
    dest: Page,
    opts?: { lat?: number; lon?: number; q?: string; hour?: string; terrasseId?: number }
  ) => {
    const lat = opts?.lat ?? searchCoords?.lat;
    const lon = opts?.lon ?? searchCoords?.lon;
    const q = opts?.q ?? searchQuery;
    const hour = opts?.hour ?? searchHour;

    setPage(dest);

    let url: string;
    if (dest === "home") {
      url = "/";
    } else if (dest === "search") {
      url = "/search";
    } else if (dest === "favorites") {
      url = "/favorites";
    } else if (dest === "about") {
      url = "/about";
    } else if (dest === "contact") {
      url = "/contact";
    } else if (dest === "results") {
      const sp = new URLSearchParams();
      if (lat != null) sp.set("lat", String(lat));
      if (lon != null) sp.set("lon", String(lon));
      if (q) sp.set("q", q);
      sp.set("date", searchDate);
      sp.set("hour", hour);
      sp.set("radius", String(searchRadius));
      sp.set("mode", mode);
      url = `/results?${sp}`;
    } else {
      // detail
      const id = opts?.terrasseId ?? selectedTerrasseId;
      if (opts?.terrasseId != null) setSelectedTerrasseId(opts.terrasseId);
      const sp = new URLSearchParams({ date: searchDate, hour, mode });
      url = `/terrasse/${id}?${sp}`;
    }

    window.history.pushState({}, "", url);
  }, [searchCoords, searchQuery, searchHour, searchDate, searchRadius, mode, selectedTerrasseId]);

  useEffect(() => {
    const { path, p } = parseCurrentUrl();
    const m = p.get("mode");
    if (m === "sun" || m === "shade") setMode(m as Mode);

    if (path === "/search") {
      setPage("search");
    } else if (path === "/results") {
      const lat = parseFloat(p.get("lat") || "");
      const lon = parseFloat(p.get("lon") || "");
      if (!isNaN(lat) && !isNaN(lon)) setSearchCoords({ lat, lon });
      const q = p.get("q"); if (q) setSearchQuery(q);
      const date = p.get("date"); if (date) setSearchDate(date);
      const hour = p.get("hour"); if (hour) setSearchHour(hour);
      const radius = p.get("radius"); if (radius) setSearchRadius(parseInt(radius));
      setPage("results");
    } else if (path.startsWith("/terrasse/")) {
      const id = parseInt(path.split("/")[2]);
      if (!isNaN(id)) {
        setSelectedTerrasseId(id);
        const date = p.get("date"); if (date) setSearchDate(date);
        const hour = p.get("hour"); if (hour) setSearchHour(hour);
        setPage("detail");
      }
    } else if (path === "/favorites") {
      setPage("favorites");
    } else if (path === "/about") {
      setPage("about");
    } else if (path === "/contact") {
      setPage("contact");
    }
    // else: home (default)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => {
      const { path, p } = parseCurrentUrl();
      const m = p.get("mode");
      if (m === "sun" || m === "shade") setMode(m as Mode);

      if (path === "/search") {
        setPage("search");
      } else if (path === "/results") {
        const lat = parseFloat(p.get("lat") || "");
        const lon = parseFloat(p.get("lon") || "");
        if (!isNaN(lat) && !isNaN(lon)) setSearchCoords({ lat, lon });
        const q = p.get("q"); if (q) setSearchQuery(q);
        const date = p.get("date"); if (date) setSearchDate(date);
        const hour = p.get("hour"); if (hour) setSearchHour(hour);
        const radius = p.get("radius"); if (radius) setSearchRadius(parseInt(radius));
        setPage("results");
      } else if (path.startsWith("/terrasse/")) {
        const id = parseInt(path.split("/")[2]);
        if (!isNaN(id)) {
          setSelectedTerrasseId(id);
          const date = p.get("date"); if (date) setSearchDate(date);
          const hour = p.get("hour"); if (hour) setSearchHour(hour);
          setPage("detail");
        }
      } else if (path === "/favorites") {
        setPage("favorites");
      } else if (path === "/about") {
        setPage("about");
      } else if (path === "/contact") {
        setPage("contact");
      } else {
        setPage("home");
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = useCallback(() => {
    if (page === "detail" && searchCoords) navigate("results");
    else if (page === "detail" || page === "results") navigate("search");
    else navigate("home");
  }, [page, searchCoords, navigate]);

  const openDetail = useCallback((terrasse: NearbyTerrasse) => {
    navigate("detail", { terrasseId: terrasse.id });
  }, [navigate]);

  const handleGeoAndSearch = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const h = Math.max(9, Math.min(19, new Date().getHours()));
        const hour = `${h.toString().padStart(2, "0")}:00`;
        setSearchCoords({ lat, lon });
        setSearchQuery("Ma position");
        setGeoLocating(false);
        setSearchHour(hour);
        navigate("results", { lat, lon, q: "Ma position", hour });
      },
      () => setGeoLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [navigate]);

  const handleGeo = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setSearchQuery("Ma position");
        setGeoLocating(false);
      },
      () => setGeoLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const selectTerrasse = useCallback((tr: TerrasseSearchResult) => {
    setSelectedTerrasseId(tr.id);
    setSearchCoords(null);
    setSearchQuery(tr.nom);
    setDropdownOpen(false);
  }, []);

  const selectAddress = useCallback((a: GeocodeResult) => {
    setSearchCoords({ lat: a.lat, lon: a.lon });
    setSelectedTerrasseId(null);
    setSearchQuery(a.label);
    setDropdownOpen(false);
  }, []);

  const selectMetro = useCallback((station: string) => {
    // Geocode the metro station
    setSearchQuery(station);
    setDropdownOpen(false);
    geocodeApi(`métro ${station}, Paris`).then((results) => {
      if (results.length > 0) {
        setSearchCoords({ lat: results[0].lat, lon: results[0].lon });
        setSelectedTerrasseId(null);
      }
    });
  }, []);

  const handleSearch = useCallback(() => {
    setDropdownOpen(false);
    if (selectedTerrasseId) {
      navigate("detail", { terrasseId: selectedTerrasseId });
    } else if (searchCoords) {
      navigate("results");
    }
  }, [selectedTerrasseId, searchCoords, navigate]);

  const handleShare = useCallback((nom: string, adresse: string | null, id?: number) => {
    const url = id ? `https://ausoleil.app/terrasse/${id}` : "https://ausoleil.app";
    const txt = `${mode === "sun" ? "☀️" : "🌤️"} ${nom} — ${adresse || "Paris"}`;
    if (navigator.share) {
      navigator.share({ title: nom, text: txt, url });
    } else {
      navigator.clipboard?.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }, [mode]);

  // ─── Shared UI ───
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 100, border: "none", fontSize: 13,
    fontWeight: active ? 600 : 400, fontFamily: F, cursor: "pointer",
    background: active ? t.accent : t.border, color: active ? "#FFF" : t.textSoft,
    transition: "all 0.2s", whiteSpace: "nowrap",
  });

  const ModeToggle = () => (
    <div style={{ display: "flex", gap: 3, background: t.border, borderRadius: 100, padding: 3 }}>
      <button onClick={() => setMode("sun")} style={{ ...pillStyle(mode === "sun"), display: "flex", alignItems: "center", gap: 6, background: mode === "sun" ? themes.sun.gradient : "transparent" }}>
        <SunIcon size={14} color={mode === "sun" ? "#FFF" : themes.sun.textMuted} /> Soleil
      </button>
      <button onClick={() => setMode("shade")} style={{ ...pillStyle(mode === "shade"), display: "flex", alignItems: "center", gap: 6, background: mode === "shade" ? themes.shade.gradient : "transparent" }}>
        <ShadeIcon size={14} color={mode === "shade" ? "#FFF" : themes.shade.textMuted} /> Ombre
      </button>
    </div>
  );

  const Nav = ({ back, title }: { back?: boolean; title: string }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", position: "sticky", top: 0, zIndex: 10, background: t.bg, borderBottom: `1px solid ${t.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {back && <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.accent }}><BackIcon /></button>}
        <span style={{ fontSize: 22, lineHeight: 1 }}>{mode === "sun" ? "☀️" : "☁️"}</span>
        {title && <span style={{ fontFamily: F, fontWeight: 600, fontSize: 16, color: t.text }}>{title}</span>}
      </div>
      <ModeToggle />
    </div>
  );

  // ─── Bottom Nav ───
  const BottomNav = () => (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: t.bgCard, borderTop: `1px solid ${t.border}`,
      boxShadow: `0 -2px 12px ${t.shadow}`,
      display: "flex", justifyContent: "center",
    }}>
      <div style={{ display: "flex", maxWidth: 860, width: "100%" }}>
        {([
          { key: "home" as Page, label: "Accueil", emoji: "🏠" },
          { key: "search" as Page, label: "Chercher", emoji: "🔍" },
          { key: "favorites" as Page, label: "Favoris", emoji: "❤️" },
          { key: "contact" as Page, label: "Contact", emoji: "✉️" },
          { key: "about" as Page, label: "Infos", emoji: "ℹ️" },
        ]).map(({ key, label, emoji }) => {
          const active = page === key;
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                padding: "8px 0 10px", background: "none", border: "none", cursor: "pointer",
                color: active ? t.accent : t.textMuted, fontFamily: F, fontSize: 10, fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 19, lineHeight: 1, opacity: active ? 1 : 0.5 }}>{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ombre;
    return (
      <span style={{
        fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100, fontFamily: F,
        color: cfg.color, background: cfg.icon === "sun" ? "#FEF3C7" : "#F3F4F6",
      }}>
        {cfg.label}
      </span>
    );
  };

  const TerrasseCard = ({ terrasse }: { terrasse: NearbyTerrasse }) => {
    const modeMatch = mode === "sun" ? isSunnyStatus(terrasse.status) : !isSunnyStatus(terrasse.status);
    return (
      <div onClick={() => openDetail(terrasse)} style={{
        background: t.bgCard, borderRadius: 16, padding: 18, cursor: "pointer",
        border: `1px solid ${modeMatch ? t.accent + "40" : t.border}`,
        boxShadow: `0 2px 12px ${t.shadow}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: F, fontWeight: 600, fontSize: 17, color: t.text }}>{terrasse.nom}</span>
              <StatusBadge status={terrasse.status} />
            </div>
            {terrasse.adresse && <div style={{ fontFamily: F, fontSize: 13, color: t.textMuted, marginBottom: 4 }}>{terrasse.adresse}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, fontFamily: F, color: t.textSoft }}>
              <span>{terrasse.distance_m}m</span>
              {terrasse.soleil_jusqua && <span style={{ color: themes.sun.accentDark }}>Soleil jusqu'à {terrasse.soleil_jusqua}</span>}
              {!terrasse.has_profile && <span style={{ color: t.textMuted, fontStyle: "italic" }}>Estimé</span>}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggleFav({ id: terrasse.id, nom: terrasse.nom, adresse: terrasse.adresse }); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: isFav(terrasse.id) ? "#EF4444" : t.textMuted }}>
            <HeartIcon filled={isFav(terrasse.id)} size={18} />
          </button>
        </div>
      </div>
    );
  };

  const wrap: React.CSSProperties = { minHeight: "100vh", background: t.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  // ─── HOME ───
  if (page === "home") {
    return (
      <div style={{ ...wrap, position: "relative", overflow: "hidden" }}>
        <div style={{ padding: "56px 24px 24px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 44 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 36, lineHeight: 1 }}>{mode === "sun" ? "☀️" : "☁️"}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 300, color: t.text, letterSpacing: -0.5, lineHeight: 1.1 }}>Terrasse</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.accent, letterSpacing: -0.5 }}>
                  {mode === "sun" ? "au soleil" : "à l'ombre"}
                </div>
              </div>
            </div>
            <ModeToggle />
          </div>

          {/* KPI */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 10 }}>
            <button onClick={() => setKpiStationIndex((i) => (i - 1 + KPI_STATIONS.length) % KPI_STATIONS.length)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: t.textMuted, padding: "2px 4px", lineHeight: 1 }}>‹</button>
            <span style={{ fontFamily: F, fontSize: 13, color: t.textSoft, fontWeight: 500 }}>
              À {kpi.station} · {kpi.hour}
            </span>
            <button onClick={() => setKpiStationIndex((i) => (i + 1) % KPI_STATIONS.length)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: t.textMuted, padding: "2px 4px", lineHeight: 1 }}>›</button>
          </div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            <img src="/logo.png" alt="" aria-hidden="true" style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              height: "200%", width: "auto",
              opacity: 0.45, pointerEvents: "none", userSelect: "none",
            }} />
            <div style={{ display: "flex" }}>
              <div style={{ flex: 1, padding: "20px 16px", textAlign: "center", background: "rgba(254, 243, 199, 0.65)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <SunIcon size={18} color="#D97706" />
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#92400E", fontFamily: F }}>{kpi.sunCount}</span>
                </div>
                <div style={{ fontSize: 12, color: "#92400E", fontFamily: F }}>terrasse{kpi.sunCount !== "..." && Number(kpi.sunCount) > 1 ? "s" : ""}</div>
                <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600, fontFamily: F }}>au soleil</div>
              </div>
              <div style={{ width: 1, background: "rgba(0,0,0,0.08)" }} />
              <div style={{ flex: 1, padding: "20px 16px", textAlign: "center", background: "rgba(243, 244, 246, 0.65)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <ShadeIcon size={18} color="#6B7280" />
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#374151", fontFamily: F }}>{kpi.shadeCount}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", fontFamily: F }}>terrasse{kpi.shadeCount !== "..." && Number(kpi.shadeCount) > 1 ? "s" : ""}</div>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, fontFamily: F }}>à l'ombre</div>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 17, color: t.textSoft, fontWeight: 300, fontStyle: "italic", lineHeight: 1.6, marginBottom: 36, maxWidth: 300 }}>
            {mode === "sun" ? "Trouve la terrasse parfaite pour profiter du soleil parisien ☀️" : "Trouve un coin d'ombre frais pour souffler un peu 🌥️"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
            <button onClick={handleGeoAndSearch} disabled={geoLocating} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "16px 24px", borderRadius: 14, border: "none",
              cursor: geoLocating ? "wait" : "pointer", background: t.gradient,
              color: "#FFF", fontSize: 16, fontWeight: 600, fontFamily: F,
              boxShadow: `0 4px 20px ${t.shadow}`, opacity: geoLocating ? 0.7 : 1,
            }}>
              {geoLocating ? <div style={{ width: 18, height: 18, border: "2px solid #FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <span>📍</span>}
              {geoLocating ? "Localisation..." : "Autour de moi"}
            </button>
            <button onClick={() => navigate("search")} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "16px 24px", borderRadius: 14, border: `2px solid ${t.accent}`,
              cursor: "pointer", background: "transparent", color: t.accent,
              fontSize: 16, fontWeight: 600, fontFamily: F,
            }}>
              🔍 Choisir un lieu
            </button>
          </div>

          {favorites.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, letterSpacing: 0.5, textTransform: "uppercase" }}>Mes favoris</span>
                <button onClick={() => navigate("favorites")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, color: t.accent, fontWeight: 500 }}>Voir tout →</button>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
                {favorites.slice(0, 3).map((fav) => (
                  <div key={fav.id} onClick={() => navigate("detail", { terrasseId: fav.id })}
                    style={{ minWidth: 155, background: t.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${t.border}`, cursor: "pointer", boxShadow: `0 2px 8px ${t.shadow}` }}>
                    <div style={{ fontFamily: F, fontWeight: 600, fontSize: 14, color: t.text, marginBottom: 4 }}>{fav.nom}</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: t.textMuted }}>{fav.adresse || ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 48, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>Paris intra-muros · Ensoleillement calculé en temps réel</span>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── SEARCH ───
  if (page === "search") {
    const hasDropdownResults =
      (searchType === "terrasse" && terrasseResults && terrasseResults.length > 0) ||
      (searchType === "address" && addressResults && addressResults.length > 0) ||
      (searchType === "metro" && filteredMetro.length > 0);
    const canSearch = !!(selectedTerrasseId || searchCoords);

    const searchTypeTabs: { key: SearchType; label: string; emoji: string }[] = [
      { key: "address", label: "Adresse", emoji: "📍" },
      { key: "terrasse", label: "Terrasse", emoji: "🍺" },
      { key: "metro", label: "Métro", emoji: "🚇" },
    ];

    const placeholders: Record<SearchType, string> = {
      address: "Rue, boulevard, place...",
      terrasse: "Nom d'un bar, restaurant...",
      metro: "Station de métro...",
    };

    return (
      <div style={wrap}>
        <Nav back title="Recherche" />
        <div style={{ padding: "20px 24px" }}>

          {/* Search type tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {searchTypeTabs.map(({ key, label, emoji }) => {
              const active = searchType === key;
              return (
                <button key={key} onClick={() => { setSearchType(key); setSearchQuery(""); setDropdownOpen(false); setSelectedTerrasseId(null); setSearchCoords(null); }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${active ? t.accent : t.border}`,
                    background: active ? t.accentLight : t.bgCard, cursor: "pointer",
                    fontFamily: F, fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? t.accentDark : t.textSoft, transition: "all 0.2s",
                  }}>
                  <span>{emoji}</span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Location input */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
              {searchType === "terrasse" ? "Établissement" : searchType === "metro" ? "Station" : "Adresse"}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchQuery(v);
                    setDropdownOpen(true);
                    setSelectedTerrasseId(null);
                    setSearchCoords(null);
                    if (v.toLowerCase().replace(/\s/g, "") === "ausoleil") {
                      setPlayEasterEgg(true);
                    }
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={placeholders[searchType]}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 12,
                    border: `1.5px solid ${t.border}`, fontFamily: F, fontSize: 15,
                    color: t.text, background: t.bgCard, outline: "none", boxSizing: "border-box",
                  }}
                />
                {dropdownOpen && hasDropdownResults && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                    background: t.bgCard, borderRadius: 12, marginTop: 4,
                    border: `1px solid ${t.border}`, boxShadow: `0 8px 24px ${t.shadow}`,
                    maxHeight: 300, overflowY: "auto",
                  }}>
                    {/* Terrasse results */}
                    {searchType === "terrasse" && terrasseResults && terrasseResults.length > 0 && (
                      terrasseResults.slice(0, 8).map((tr) => (
                        <div key={tr.id} onClick={() => selectTerrasse(tr)}
                          style={{ display: "flex", flexDirection: "column", padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${t.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CoffeeIcon size={14} color={t.textMuted} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: t.text, fontFamily: F }}>{tr.nom}</span>
                          </div>
                          <span style={{ fontSize: 12, color: t.textMuted, fontFamily: F, marginLeft: 22 }}>{tr.adresse}</span>
                        </div>
                      ))
                    )}

                    {/* Address results */}
                    {searchType === "address" && addressResults && addressResults.length > 0 && (
                      addressResults.slice(0, 8).map((a, i) => (
                        <div key={i} onClick={() => selectAddress(a)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${t.border}` }}>
                          <MapPinIcon size={14} />
                          <span style={{ fontSize: 14, color: t.text, fontFamily: F }}>{a.label}</span>
                        </div>
                      ))
                    )}

                    {/* Metro results */}
                    {searchType === "metro" && filteredMetro.map((station) => (
                      <div key={station} onClick={() => selectMetro(station)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${t.border}` }}>
                        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: t.textSoft, background: t.border, borderRadius: 4, padding: "1px 5px", lineHeight: "18px" }}>M</span>
                        <span style={{ fontSize: 14, color: t.text, fontFamily: F }}>{station}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleGeo} style={{
                width: 48, height: 48, borderRadius: 12, border: `1.5px solid ${t.border}`,
                background: t.bgCard, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", color: geoLocating ? t.accent : t.textSoft, flexShrink: 0,
              }}>
                {geoLocating
                  ? <div style={{ width: 18, height: 18, border: `2px solid ${t.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  : <CrosshairIcon size={20} />}
              </button>
            </div>
          </div>

          {/* Date */}
          <div style={{ marginTop: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
              Date
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {(() => {
                const today = todayISO();
                const d1 = new Date(); d1.setDate(d1.getDate() + 1);
                const tomorrow = d1.toISOString().split("T")[0];
                const d2 = new Date(); d2.setDate(d2.getDate() + 2);
                const afterTomorrow = d2.toISOString().split("T")[0];
                const dateOptions = [
                  { value: today, label: "Aujourd'hui" },
                  { value: tomorrow, label: "Demain" },
                  { value: afterTomorrow, label: "Après-demain" },
                ];
                return (
                  <>
                    {dateOptions.map(({ value, label }) => (
                      <button key={value} onClick={() => setSearchDate(value)} style={pillStyle(searchDate === value)}>{label}</button>
                    ))}
                    <input
                      type="date"
                      value={searchDate}
                      min={today}
                      onChange={(e) => setSearchDate(e.target.value)}
                      style={{
                        padding: "7px 12px", borderRadius: 100, border: `1.5px solid ${t.border}`,
                        fontFamily: F, fontSize: 13, color: t.text, background: t.bgCard,
                        cursor: "pointer", outline: "none",
                      }}
                    />
                  </>
                );
              })()}
            </div>
          </div>

          {/* Hour */}
          <div style={{ marginTop: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
              Heure
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {HOURS.map((h) => {
                const past = searchDate === todayISO() && parseInt(h) < new Date().getHours();
                return (
                  <button key={h} onClick={() => !past && setSearchHour(h)} style={{ ...pillStyle(searchHour === h), ...(past ? { opacity: 0.3, cursor: "default" } : {}) }}>{h}</button>
                );
              })}
            </div>
          </div>

          {/* Search button */}
          <button onClick={handleSearch} disabled={!canSearch} style={{
            width: "100%", marginTop: 36, padding: "16px", borderRadius: 14, border: "none",
            background: canSearch ? t.gradient : t.border, color: canSearch ? "#FFF" : t.textMuted,
            fontSize: 16, fontWeight: 600, fontFamily: F, cursor: canSearch ? "pointer" : "default",
            boxShadow: canSearch ? `0 4px 20px ${t.shadow}` : "none",
          }}>
            {selectedTerrasseId
              ? "Voir la timeline"
              : mode === "sun" ? "☀️  Trouver du soleil" : "🌤️  Trouver de l'ombre"}
          </button>
        </div>
        {playEasterEgg && <audio src="/ausoleil.mp3" autoPlay onEnded={() => setPlayEasterEgg(false)} style={{ display: "none" }} />}
        <BottomNav />
      </div>
    );
  }

  // ─── RESULTS ───
  if (page === "results") {
    return (
      <div style={wrap}>
        <Nav back title={mode === "sun" ? "Terrasses au soleil" : "Terrasses à l'ombre"} />
        <div style={{ padding: "12px 24px 24px" }}>
          {/* Erreur API */}
          {nearbyError && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FEF2F2", borderRadius: 10, marginBottom: 12, border: "1px solid #FECACA" }}>
              <span>⚠️</span>
              <span style={{ fontFamily: F, fontSize: 13, color: "#DC2626" }}>Service temporairement indisponible — réessaie dans quelques instants.</span>
            </div>
          )}

          {/* Date picker */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => { const d = new Date(searchDate + "T12:00:00"); d.setDate(d.getDate() - 1); setSearchDate(d.toISOString().split("T")[0]); }}
              style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: F, fontSize: 13, color: t.textSoft }}>
              ←
            </button>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: t.text, textTransform: "capitalize" }}>
              {searchDate === todayISO() ? "Aujourd'hui" : searchDate === (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })() ? "Demain" : new Date(searchDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              {nearbyData && ` · ${nearbyData.meteo.status === "degage" ? "☀️" : nearbyData.meteo.status === "mitige" ? "🌤️" : "☁️"}`}
            </span>
            <button onClick={() => { const d = new Date(searchDate + "T12:00:00"); d.setDate(d.getDate() + 1); setSearchDate(d.toISOString().split("T")[0]); }}
              style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: F, fontSize: 13, color: t.textSoft }}>
              →
            </button>
          </div>

          {/* Hour + Radius filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
              {HOURS.map((h) => {
                const active = (searchHour || currentHourKey()) === h;
                return (
                  <button key={h} onClick={() => setSearchHour(h)} style={{
                    flexShrink: 0, padding: "6px 13px", borderRadius: 20, cursor: "pointer", fontFamily: F,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    border: `1.5px solid ${active ? t.accent : t.border}`,
                    background: active ? t.accent : t.bgCard,
                    color: active ? "#FFF" : t.textSoft,
                  }}>{h}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([100, 250, 500] as const).map((r) => {
                const active = searchRadius === r;
                return (
                  <button key={r} onClick={() => setSearchRadius(r)} style={{
                    padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: F,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    border: `1.5px solid ${active ? t.accent : t.border}`,
                    background: active ? t.accent : t.bgCard,
                    color: active ? "#FFF" : t.textSoft,
                  }}>{r} m</button>
                );
              })}
            </div>
          </div>

          {nearbyLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 80, background: t.border, borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{mode === "sun" ? "🌧️" : "☀️"}</div>
              <div style={{ fontSize: 16, color: t.textSoft, fontWeight: 500 }}>Aucune terrasse {mode === "sun" ? "ensoleillée" : "ombragée"} trouvée</div>
              <div style={{ fontSize: 14, color: t.textMuted, marginTop: 8 }}>Essaye un autre créneau ou un autre lieu.</div>
              <button onClick={() => navigate("search")} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "none", background: t.accent, color: "#FFF", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>
                Modifier la recherche
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 6, fontSize: 13, lineHeight: 1.4 }}>
                  {(["all", "sun", "shade"] as const).map((f) => {
                    const sunN = results.filter(r => isSunnyStatus(r.status)).length;
                    const shadeN = results.filter(r => !isSunnyStatus(r.status)).length;
                    const label = f === "all" ? `Tous (${results.length})` : f === "sun" ? `☀️ ${sunN} au soleil` : `🏢 ${shadeN} à l'ombre`;
                    const active = resultFilter === f;
                    return (
                      <button key={f} onClick={() => setResultFilter(f)} style={{
                        padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontFamily: F,
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        border: `1.5px solid ${active ? t.accent : t.border}`,
                        background: active ? t.accentLight : "transparent",
                        color: active ? t.accentDark : t.textMuted,
                      }}>{label}</button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 2, background: t.border, borderRadius: 10, padding: 3 }}>
                  <button onClick={() => setViewMode("list")} style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
                    border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: viewMode === "list" ? 600 : 400,
                    background: viewMode === "list" ? t.bgCard : "transparent",
                    color: viewMode === "list" ? t.accent : t.textMuted,
                    boxShadow: viewMode === "list" ? `0 1px 3px ${t.shadow}` : "none",
                  }}><ListIcon size={14} /> Liste</button>
                  <button onClick={() => setViewMode("map")} style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
                    border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: viewMode === "map" ? 600 : 400,
                    background: viewMode === "map" ? t.bgCard : "transparent",
                    color: viewMode === "map" ? t.accent : t.textMuted,
                    boxShadow: viewMode === "map" ? `0 1px 3px ${t.shadow}` : "none",
                  }}><MapPinIcon size={14} /> Carte</button>
                </div>
              </div>

              {viewMode === "map" ? (
                <ResultsMap terrasses={results.filter(r => resultFilter === "all" || (resultFilter === "sun" ? isSunnyStatus(r.status) : !isSunnyStatus(r.status)))} mode={mode} onTerrasseClick={openDetail} onCenterChange={(lat, lon) => setSearchCoords({ lat, lon })} />
              ) : (
                <div className="terrasse-grid">
                  {results.filter(r => resultFilter === "all" || (resultFilter === "sun" ? isSunnyStatus(r.status) : !isSunnyStatus(r.status))).map((tr) => <TerrasseCard key={tr.id} terrasse={tr} />)}
                </div>
              )}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── DETAIL ───
  if (page === "detail") {
    if (timelineLoading || !timelineData) {
      return (
        <div style={wrap}>
          <Nav back title="" />
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${t.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <span style={{ fontSize: 14, color: t.textMuted }}>Chargement de la timeline...</span>
          </div>
          <BottomNav />
        </div>
      );
    }

    const terrasse = timelineData.terrasse;
    const bestWindow = timelineData.meilleur_creneau;
    const selectedHour = searchHour || currentHourKey();
    const currentSlot = timelineData.slots.find((s) => s.time === selectedHour) ||
      timelineData.slots.find((s) => s.time.startsWith(selectedHour.split(":")[0]));
    const currentStatus = currentSlot?.status || "nuit";
    const good = mode === "sun" ? isSunnyStatus(currentStatus) : !isSunnyStatus(currentStatus);

    return (
      <div style={wrap}>
        <Nav back title="" />

        {/* Hero card */}
        <div style={{ margin: "0 20px 20px", padding: "28px 24px", borderRadius: 20, background: t.gradient, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#FFF", marginBottom: 6 }}>{terrasse.nom}</div>
            {terrasse.adresse && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{terrasse.adresse}</div>}
            {terrasse.arrondissement && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{terrasse.arrondissement}</div>}
          </div>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          {/* Current status */}
          <div style={{ padding: "14px 18px", borderRadius: 14, marginBottom: 20, background: good ? t.accentLight : "#FEE2E2", border: `1px solid ${good ? t.accentLight : "#FECACA"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {mode === "sun" ? <SunIcon size={20} color={good ? t.accentDark : "#EF4444"} /> : <ShadeIcon size={20} color={good ? t.accentDark : "#EF4444"} />}
              <span style={{ fontSize: 15, fontWeight: 600, color: good ? t.accentDark : "#DC2626" }}>
                {good ? `${mode === "sun" ? "Ensoleillée" : "Ombragée"} à ${selectedHour}` : `Pas ${mode === "sun" ? "de soleil" : "d'ombre"} à ${selectedHour}`}
              </span>
            </div>
          </div>

          {/* Best window */}
          {bestWindow && (
            <div style={{ padding: "14px 18px", borderRadius: 14, marginBottom: 20, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
              <div style={{ fontFamily: F, fontWeight: 600, fontSize: 14, color: "#92400E", marginBottom: 4 }}>
                Meilleur créneau : {bestWindow.debut} – {bestWindow.fin}
              </div>
              <div style={{ fontFamily: F, fontSize: 13, color: "#B45309" }}>
                {bestWindow.duree_minutes} min de soleil + ciel dégagé
              </div>
            </div>
          )}

          {/* Weather summary */}
          <div style={{ fontSize: 13, color: t.textSoft, marginBottom: 16 }}>{timelineData.meteo_resume}</div>

          {/* Sun direction map */}
          <SunMap lat={terrasse.lat} lon={terrasse.lon} date={timelineData.date} selectedTime={selectedHour} theme={t} />

          {/* Hourly summary grid */}
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10, display: "block" }}>
              Ensoleillement
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {HOURS.map((h) => {
                const slot = hourlyFromTimeline[h];
                const status = slot?.status;
                const sunny = status ? isSunnyStatus(status) : false;
                const isSelected = h === selectedHour;
                return (
                  <div key={h} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      height: 28, borderRadius: 6, marginBottom: 4,
                      background: isSelected ? (sunny ? t.accent : "#EF4444") : (sunny ? t.accentLight : t.border),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {sunny ? <SunIcon size={11} color={isSelected ? "#FFF" : t.accentDark} /> : <ShadeIcon size={11} color={isSelected ? "#FFF" : t.textMuted} />}
                    </div>
                    <span style={{ fontSize: 9, color: isSelected ? t.accent : t.textMuted, fontWeight: isSelected ? 700 : 400 }}>{h.split(":")[0]}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => toggleFav({ id: terrasse.id, nom: terrasse.nom, adresse: terrasse.adresse })}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px", borderRadius: 12, border: `1.5px solid ${isFav(terrasse.id) ? "#EF4444" : t.border}`,
                background: isFav(terrasse.id) ? "#FEF2F2" : t.bgCard, cursor: "pointer",
                color: isFav(terrasse.id) ? "#EF4444" : t.text, fontFamily: F, fontSize: 14, fontWeight: 500,
              }}>
              {isFav(terrasse.id) ? "❤️" : "🤍"} {isFav(terrasse.id) ? "Favori" : "Sauver"}
            </button>
            <button onClick={() => handleShare(terrasse.nom, terrasse.adresse, terrasse.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px", borderRadius: 12, border: `1.5px solid ${t.border}`,
                background: t.bgCard, cursor: "pointer", color: t.text, fontFamily: F, fontSize: 14, fontWeight: 500,
              }}>
              📤 {shared ? "Copié !" : "Envoyer aux potes"}
            </button>
          </div>

          {/* Sunny hours pills */}
          <div style={{ marginTop: 24, padding: "16px 18px", background: t.bgCard, borderRadius: 14, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
              Créneaux {mode === "sun" ? "ensoleillés" : "ombragés"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(() => {
                const matchingHours = HOURS.filter((h) => {
                  const slot = hourlyFromTimeline[h];
                  if (!slot) return false;
                  return mode === "sun" ? isSunnyStatus(slot.status) : !isSunnyStatus(slot.status);
                });
                return matchingHours.length > 0 ? (
                  matchingHours.map((h) => (
                    <span key={h} style={{ padding: "6px 14px", borderRadius: 100, fontSize: 13, fontWeight: 500, background: t.accentLight, color: t.accentDark, fontFamily: F }}>{h}</span>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: t.textMuted }}>Aucun créneau disponible</span>
                );
              })()}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── FAVORITES ───
  if (page === "favorites") {
    return (
      <div style={wrap}>
        <Nav back title="Mes favoris" />
        <div style={{ padding: "12px 24px 24px" }}>
          {favorites.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💛</div>
              <div style={{ fontSize: 16, color: t.textSoft, fontWeight: 500 }}>Aucun favori pour le moment</div>
              <div style={{ fontSize: 14, color: t.textMuted, marginTop: 8 }}>Ajoute tes terrasses préférées ici.</div>
              <button onClick={() => navigate("home")} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "none", background: t.accent, color: "#FFF", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>
                Explorer
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {favorites.map((fav) => (
                <div key={fav.id} onClick={() => navigate("detail", { terrasseId: fav.id })}
                  style={{
                    background: t.bgCard, borderRadius: 16, padding: 18, cursor: "pointer",
                    border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.shadow}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                  <div>
                    <div style={{ fontFamily: F, fontWeight: 600, fontSize: 16, color: t.text, marginBottom: 4 }}>{fav.nom}</div>
                    <div style={{ fontFamily: F, fontSize: 13, color: t.textMuted }}>{fav.adresse || ""}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleFav(fav); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#EF4444" }}>
                    <HeartIcon filled size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── ABOUT ───
  if (page === "about") {
    const section = (title: string, content: React.ReactNode) => (
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: F, fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontFamily: F, fontSize: 14, color: t.textSoft, lineHeight: 1.6 }}>{content}</div>
      </div>
    );
    return (
      <div style={wrap}>
        <Nav back title="À propos" />
        <div style={{ padding: "20px 24px 100px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>☀️</div>
            <div style={{ fontFamily: F, fontWeight: 700, fontSize: 20, color: t.text }}>Au Soleil</div>
            <div style={{ fontFamily: F, fontSize: 13, color: t.textMuted, marginTop: 4 }}>Trouve une terrasse ensoleillée à Paris</div>
          </div>

          {section("🍺 Le concept", <>
            Tu sors du boulot, tu veux un verre au soleil — mais tu sais jamais si ta terrasse préférée est à l'ombre à cette heure-là. On a tous vécu la déception.<br /><br />
            <em>Au Soleil</em> répond à cette question : <strong>est-ce que ma terrasse est au soleil en ce moment ?</strong> Et pour les jours de canicule, on gère aussi le mode ombre. ⛱️
          </>)}

          {section("🔭 Comment ça marche ?", <>
            Pour chaque terrasse, on calcule un <strong>profil d'horizon</strong> à partir des bâtiments environnants (jusqu'à 200m de rayon). On combine ensuite la position du soleil — calculée à la minute près — avec ce profil pour déterminer si la terrasse est ensoleillée, à l'ombre ou entre les deux.<br /><br />
            Les données de bâtiments viennent de la <strong>BD TOPO® IGN</strong> (bâtiments 3D sur Paris). La météo vient d'<strong>Open-Meteo</strong> (gratuit, sans clé).
          </>)}

          {section("🗺️ Pourquoi seulement Paris ?", <>
            Paris est couverte par la BD TOPO IGN avec une bonne précision 3D et par les données ouvertes de terrasses — c'est le combo parfait pour démarrer. D'autres villes pourraient suivre si le projet prend de l'ampleur. 📍
          </>)}

          {section("🤔 Pourquoi mon bar préféré n'y est pas ?", <>
            Les terrasses référencées viennent des <strong>données ouvertes de la Ville de Paris</strong> (autorisations de terrasses). Seules les « terrasses ouvertes » officiellement déclarées y figurent. Si ton bar n'est pas là, c'est probablement qu'il n'a pas d'autorisation enregistrée — pas qu'il est nul.
          </>)}

          {section("🛠️ Technologies", <>
            <strong>Backend :</strong> Python · FastAPI · PostGIS<br />
            <strong>Frontend :</strong> React · TypeScript · MapLibre GL<br />
            <strong>Infra :</strong> Docker · Traefik · VPS OVH<br />
            <strong>Données :</strong> BD TOPO IGN · Open Data Paris · Open-Meteo<br /><br />
            Fait avec amour 🫶 par Virginie, Bertrand et Claude.
          </>)}

          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 20, textAlign: "center" }}>
            <a href="https://github.com/bmatge/ma-terrasse-au-soleil" target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: F, fontSize: 13, color: t.accent, textDecoration: "none" }}>
              Code source sur GitHub →
            </a>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (page === "contact") {
    return (
      <div style={wrap}>
        <Nav back title="Contact" />
        <div style={{ padding: "20px 24px 100px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✉️</div>
            <div style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: t.text }}>Écris-nous</div>
            <div style={{ fontFamily: F, fontSize: 13, color: t.textMuted, marginTop: 4 }}>
              Une idée, un bug, un bar à ajouter ?<br />On lit tout.
            </div>
          </div>
          <ContactForm theme={t} fontFamily={F} />
        </div>
        <BottomNav />
      </div>
    );
  }

  return null;
}
