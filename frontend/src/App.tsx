import { useState, useEffect, useRef, useCallback } from "react";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cspWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";

setWorkerUrl(cspWorkerUrl);

// ─── Types ───
interface CafeSun {
  [hour: string]: boolean;
}

interface Cafe {
  id: number;
  name: string;
  address: string;
  metro: string;
  zone: string;
  rating: number;
  sun: CafeSun;
  vibe: string;
  price: string;
  lat: number;
  lon: number;
}

type Page = "home" | "search" | "results" | "detail" | "favorites";
type Mode = "sun" | "shade";
type ViewMode = "list" | "map";

// ─── Mock Data ───
const CAFES: Cafe[] = [
  { id:1, name:"Le Baron Rouge", address:"1 rue Théophile Roussel, 75012", metro:"Ledru-Rollin", zone:"aligre", rating:4.7, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":true,"13:00":false,"14:00":false,"15:00":false,"16:00":true,"17:00":true,"18:00":true,"19:00":true}, vibe:"Bistrot", price:"€", lat:48.8499, lon:2.3783 },
  { id:2, name:"L'Ébauchoir", address:"43 rue de Cîteaux, 75012", metro:"Faidherbe-Chaligny", zone:"aligre", rating:4.4, sun:{"09:00":false,"10:00":true,"11:00":true,"12:00":true,"13:00":true,"14:00":true,"15:00":true,"16:00":false,"17:00":false,"18:00":false,"19:00":false}, vibe:"Néo-bistrot", price:"€€", lat:48.8490, lon:2.3826 },
  { id:3, name:"Café Aligre", address:"Place d'Aligre, 75012", metro:"Ledru-Rollin", zone:"aligre", rating:4.2, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":true,"13:00":true,"14:00":false,"15:00":false,"16:00":false,"17:00":true,"18:00":true,"19:00":true}, vibe:"Marché", price:"€", lat:48.8488, lon:2.3793 },
  { id:4, name:"Le Square Trousseau", address:"1 rue Antoine Vollon, 75012", metro:"Ledru-Rollin", zone:"aligre", rating:4.3, sun:{"09:00":true,"10:00":true,"11:00":false,"12:00":false,"13:00":true,"14:00":true,"15:00":true,"16:00":true,"17:00":true,"18:00":false,"19:00":false}, vibe:"Brasserie", price:"€€", lat:48.8497, lon:2.3787 },
  { id:5, name:"La Félicité", address:"14 rue de Charonne, 75011", metro:"Bastille", zone:"bastille", rating:4.0, sun:{"09:00":true,"10:00":true,"11:00":false,"12:00":false,"13:00":false,"14:00":true,"15:00":true,"16:00":true,"17:00":true,"18:00":false,"19:00":false}, vibe:"Café calme", price:"€€", lat:48.8529, lon:2.3734 },
  { id:6, name:"Le Pause Café", address:"41 rue de Charonne, 75011", metro:"Bastille", zone:"bastille", rating:4.1, sun:{"09:00":false,"10:00":false,"11:00":true,"12:00":true,"13:00":true,"14:00":true,"15:00":true,"16:00":true,"17:00":false,"18:00":false,"19:00":false}, vibe:"Grande terrasse", price:"€€", lat:48.8527, lon:2.3760 },
  { id:7, name:"Aux Deux Amis", address:"45 rue Oberkampf, 75011", metro:"Oberkampf", zone:"oberkampf", rating:4.6, sun:{"09:00":false,"10:00":false,"11:00":false,"12:00":true,"13:00":true,"14:00":true,"15:00":true,"16:00":true,"17:00":true,"18:00":true,"19:00":false}, vibe:"Bar à vins", price:"€€", lat:48.8651, lon:2.3758 },
  { id:8, name:"Café Oberkampf", address:"3 rue Neuve Popincourt, 75011", metro:"Parmentier", zone:"oberkampf", rating:4.1, sun:{"09:00":false,"10:00":false,"11:00":true,"12:00":true,"13:00":true,"14:00":false,"15:00":false,"16:00":false,"17:00":true,"18:00":true,"19:00":true}, vibe:"Hipster", price:"€€", lat:48.8645, lon:2.3735 },
  { id:9, name:"Café de Flore", address:"172 bd Saint-Germain, 75006", metro:"Saint-Germain-des-Prés", zone:"stgermain", rating:4.1, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":false,"13:00":false,"14:00":false,"15:00":true,"16:00":true,"17:00":true,"18:00":true,"19:00":false}, vibe:"Littéraire", price:"€€€", lat:48.8541, lon:2.3326 },
  { id:10, name:"Le Sélect", address:"99 bd du Montparnasse, 75006", metro:"Vavin", zone:"montparnasse", rating:4.3, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":true,"13:00":true,"14:00":false,"15:00":false,"16:00":false,"17:00":false,"18:00":true,"19:00":true}, vibe:"Classique", price:"€€", lat:48.8433, lon:2.3286 },
  { id:11, name:"Le Perchoir Marais", address:"33 rue de la Verrerie, 75004", metro:"Hôtel de Ville", zone:"marais", rating:4.5, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":true,"13:00":true,"14:00":true,"15:00":true,"16:00":true,"17:00":true,"18:00":true,"19:00":true}, vibe:"Rooftop", price:"€€€", lat:48.8570, lon:2.3530 },
  { id:12, name:"Le Pavillon Puebla", address:"Parc des Buttes-Chaumont, 75019", metro:"Buttes Chaumont", zone:"butteschaumont", rating:4.3, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":true,"13:00":true,"14:00":true,"15:00":true,"16:00":true,"17:00":true,"18:00":true,"19:00":true}, vibe:"Parc", price:"€€", lat:48.8808, lon:2.3828 },
  { id:13, name:"Le Bouillon Chartier", address:"7 rue du Fg Montmartre, 75009", metro:"Grands Boulevards", zone:"boulevards", rating:4.4, sun:{"09:00":false,"10:00":true,"11:00":true,"12:00":true,"13:00":true,"14:00":true,"15:00":false,"16:00":false,"17:00":false,"18:00":false,"19:00":false}, vibe:"Populaire", price:"€", lat:48.8713, lon:2.3441 },
  { id:14, name:"Chez Prune", address:"36 rue Beaurepaire, 75010", metro:"République", zone:"republique", rating:4.2, sun:{"09:00":true,"10:00":true,"11:00":true,"12:00":true,"13:00":false,"14:00":false,"15:00":true,"16:00":true,"17:00":true,"18:00":true,"19:00":false}, vibe:"Canal", price:"€", lat:48.8713, lon:2.3620 },
  { id:15, name:"Le Dalou", address:"Place de la Nation, 75012", metro:"Nation", zone:"nation", rating:3.9, sun:{"09:00":false,"10:00":false,"11:00":true,"12:00":true,"13:00":true,"14:00":true,"15:00":true,"16:00":true,"17:00":true,"18:00":true,"19:00":false}, vibe:"Grande terrasse", price:"€", lat:48.8488, lon:2.3960 },
];

const METRO_STATIONS = [
  "Bastille","République","Nation","Opéra","Châtelet","Saint-Lazare",
  "Montparnasse","Gare de Lyon","Gare du Nord","Belleville",
  "Oberkampf","Parmentier","Ménilmontant","Père Lachaise",
  "Ledru-Rollin","Faidherbe-Chaligny","Reuilly-Diderot","Gare de l'Est",
  "Grands Boulevards","Bonne Nouvelle","Strasbourg-Saint-Denis",
  "Arts et Métiers","Hôtel de Ville","Saint-Paul","Pont Marie",
  "Sully-Morland","Quai de la Rapée","Bercy","Vavin",
  "Saint-Germain-des-Prés","Odéon","Cluny-La Sorbonne",
  "Maubert-Mutualité","Cardinal Lemoine","Jussieu","Place Monge",
  "Buttes Chaumont","Botzaris","Laumière","Jaurès","Place d'Aligre"
].sort();

const HOURS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ─── Icons ───
const SunIcon = ({size=24,color="currentColor"}: {size?: number; color?: string}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const ShadeIcon = ({size=24,color="currentColor"}: {size?: number; color?: string}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const HeartIcon = ({filled,size=20}: {filled: boolean; size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const BackIcon = () => <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const StarIcon = ({size=14}: {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const ShareIcon = ({size=16}: {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
const CrosshairIcon = ({size=20}: {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>;
const ClockIcon = ({size=16}: {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const ListIcon = ({size=18}: {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const MapPinIcon = ({size=18}: {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;

// ─── Themes ───
const themes = {
  sun: { bg:"#FFFBF2",bgCard:"#FFFFFF",accent:"#F59E0B",accentLight:"#FEF3C7",accentDark:"#D97706",text:"#1C1917",textSoft:"#78716C",textMuted:"#A8A29E",border:"#F5F0E8",badge:"#FDE68A",badgeText:"#92400E",gradient:"linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",shadow:"rgba(245,158,11,0.12)" },
  shade: { bg:"#F0F4F8",bgCard:"#FFFFFF",accent:"#3B82F6",accentLight:"#DBEAFE",accentDark:"#2563EB",text:"#1E293B",textSoft:"#64748B",textMuted:"#94A3B8",border:"#E2E8F0",badge:"#BFDBFE",badgeText:"#1E40AF",gradient:"linear-gradient(135deg, #BFDBFE 0%, #3B82F6 100%)",shadow:"rgba(59,130,246,0.12)" },
};

// ─── Zone aliases ───
const ZONE_ALIASES: Record<string, string[]> = {
  aligre:["aligre","ledru-rollin","faidherbe","12e","75012"],
  bastille:["bastille","charonne","ledru-rollin"],
  oberkampf:["oberkampf","parmentier","menilmontant","11e","75011"],
  stgermain:["saint-germain","germain","6e","75006","odeon"],
  montparnasse:["montparnasse","vavin"],
  marais:["marais","hotel de ville","saint-paul","4e","75004"],
  butteschaumont:["buttes","chaumont","19e","75019"],
  boulevards:["boulevards","grands boulevards","9e","75009"],
  republique:["republique","canal","10e","75010"],
  nation:["nation"],
};

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

// ─── Map tile config ───
const STYLE_URL = "/tiles/styles/liberty";
const TILE_ORIGIN = "https://tiles.openfreemap.org/";

// ─── Results Map Component ───
function ResultsMap({ cafes, mode, onCafeClick }: { cafes: Cafe[]; mode: Mode; onCafeClick: (cafe: Cafe) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onCafeClickRef = useRef(onCafeClick);
  onCafeClickRef.current = onCafeClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Compute center from cafes
    const avgLat = cafes.reduce((s, c) => s + c.lat, 0) / (cafes.length || 1);
    const avgLon = cafes.reduce((s, c) => s + c.lon, 0) / (cafes.length || 1);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [avgLon || 2.3522, avgLat || 48.8566],
      zoom: 13,
      attributionControl: {},
      transformRequest: (url: string) => {
        if (url.startsWith(TILE_ORIGIN)) {
          return { url: url.replace(TILE_ORIGIN, "/tiles/") };
        }
        return { url };
      },
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when cafes change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const color = mode === "sun" ? "#F59E0B" : "#3B82F6";

    cafes.forEach((cafe) => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 14px; height: 14px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;

      const popup = new maplibregl.Popup({ offset: 10 }).setHTML(`
        <div style="font-size:13px;font-family:${F}">
          <strong>${cafe.name}</strong><br/>
          <span style="color:#78716C">${cafe.metro}</span><br/>
          <span>${cafe.price} · ${cafe.vibe}</span>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cafe.lon, cafe.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => onCafeClickRef.current(cafe));
      markersRef.current.push(marker);
    });

    // Fit bounds if multiple cafes
    if (cafes.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      cafes.forEach((c) => bounds.extend([c.lon, c.lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    } else if (cafes.length === 1) {
      map.flyTo({ center: [cafes[0].lon, cafes[0].lat], zoom: 15 });
    }
  }, [cafes, mode]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 360, borderRadius: 14, overflow: "hidden", border: `1px solid ${themes[mode].border}` }}
    />
  );
}

// ─── KPI helpers ───
function getCurrentHourKey(): string {
  const now = new Date();
  const h = now.getHours();
  const clamped = Math.max(9, Math.min(19, h));
  return `${clamped.toString().padStart(2, "0")}:00`;
}

function getKpi() {
  const hour = getCurrentHourKey();
  let sunCount = 0;
  let shadeCount = 0;
  for (const c of CAFES) {
    if (c.sun[hour]) sunCount++;
    else shadeCount++;
  }
  return { hour, sunCount, shadeCount };
}

// ─── Main App ───
export default function App() {
  const [mode, setMode] = useState<Mode>("sun");
  const [page, setPage] = useState<Page>("home");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [searchLocation, setSearchLocation] = useState("");
  const [searchHour, setSearchHour] = useState("");
  const [searchDuration, setSearchDuration] = useState(60);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [geoLocating, setGeoLocating] = useState(false);
  const [shared, setShared] = useState(false);
  const [metroOpen, setMetroOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const t = themes[mode];

  const toggleFav = (id: number) => setFavorites(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const isFav = (id: number) => favorites.includes(id);

  const filteredMetro = METRO_STATIONS.filter(s => normalize(s).includes(normalize(searchLocation || "")));

  const matchesLocation = useCallback((cafe: Cafe, query: string) => {
    if (!query) return true;
    const q = normalize(query);
    if (normalize(cafe.name).includes(q)||normalize(cafe.metro).includes(q)||normalize(cafe.address).includes(q)) return true;
    for (const [zone, kws] of Object.entries(ZONE_ALIASES)) {
      if (kws.some(kw => q.includes(normalize(kw)) || normalize(kw).includes(q))) {
        if (cafe.zone === zone) return true;
      }
    }
    return false;
  }, []);

  const getResults = useCallback(() => {
    const hour = searchHour || "14:00";
    const wantSun = mode === "sun";
    const sunFiltered = CAFES.filter(c => {
      const ok = wantSun ? c.sun[hour] : !c.sun[hour];
      if (!ok) return false;
      if (searchDuration >= 120) {
        const idx = HOURS.indexOf(hour);
        if (idx >= 0 && idx < HOURS.length - 1) {
          const next = wantSun ? c.sun[HOURS[idx+1]] : !c.sun[HOURS[idx+1]];
          if (!next) return false;
        }
      }
      return true;
    });
    if (searchLocation) {
      const locRes = sunFiltered.filter(c => matchesLocation(c, searchLocation));
      if (locRes.length > 0) return locRes;
    }
    return sunFiltered;
  }, [searchHour, mode, searchDuration, searchLocation, matchesLocation]);

  const handleGeo = () => {
    setGeoLocating(true);
    setTimeout(() => {
      setSearchLocation("Place d'Aligre");
      setGeoLocating(false);
    }, 1000);
  };

  const handleShare = (cafe: Cafe) => {
    const txt = `${mode==="sun"?"☀️":"🌤️"} ${cafe.name} — ${cafe.address}\nTerrasse ${mode==="sun"?"au soleil":"à l'ombre"} à ${searchHour||"14:00"} !`;
    if (navigator.share) {
      navigator.share({title:"Terrasse au soleil",text:txt});
    } else {
      navigator.clipboard?.writeText(txt);
      setShared(true);
      setTimeout(()=>setShared(false),2000);
    }
  };

  const goBack = () => {
    if (page==="detail") setPage("results");
    else setPage("home");
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding:"8px 18px",borderRadius:100,border:"none",fontSize:13,
    fontWeight:active?600:400,fontFamily:F,cursor:"pointer",
    background:active?t.accent:t.border,color:active?"#FFF":t.textSoft,
    transition:"all 0.2s",whiteSpace:"nowrap",
  });

  const ModeToggle = () => (
    <div style={{display:"flex",gap:3,background:t.border,borderRadius:100,padding:3}}>
      <button onClick={()=>setMode("sun")} style={{...pillStyle(mode==="sun"),display:"flex",alignItems:"center",gap:6,background:mode==="sun"?themes.sun.gradient:"transparent"}}>
        <SunIcon size={14} color={mode==="sun"?"#FFF":themes.sun.textMuted}/> Soleil
      </button>
      <button onClick={()=>setMode("shade")} style={{...pillStyle(mode==="shade"),display:"flex",alignItems:"center",gap:6,background:mode==="shade"?themes.shade.gradient:"transparent"}}>
        <ShadeIcon size={14} color={mode==="shade"?"#FFF":themes.shade.textMuted}/> Ombre
      </button>
    </div>
  );

  const Nav = ({back,title}: {back?: boolean; title: string}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",position:"sticky",top:0,zIndex:10,background:t.bg,borderBottom:`1px solid ${t.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {back && <button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:t.accent}}><BackIcon/></button>}
        {title && <span style={{fontFamily:F,fontWeight:600,fontSize:16,color:t.text}}>{title}</span>}
      </div>
      <button onClick={()=>setPage("favorites")} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:page==="favorites"?t.accent:t.textMuted}}>
        <HeartIcon filled={page==="favorites"} size={22}/>
      </button>
    </div>
  );

  const CafeCard = ({cafe,compact}: {cafe: Cafe; compact?: boolean}) => {
    const hour = searchHour || "14:00";
    return (
      <div onClick={()=>{setSelectedCafe(cafe);setPage("detail");}} style={{background:t.bgCard,borderRadius:16,padding:compact?14:18,cursor:"pointer",border:`1px solid ${t.border}`,boxShadow:`0 2px 12px ${t.shadow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontFamily:F,fontWeight:600,fontSize:compact?15:17,color:t.text}}>{cafe.name}</span>
              <span style={{background:t.badge,color:t.badgeText,fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:100,fontFamily:F}}>{cafe.price}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
              <span style={{fontFamily:F,fontSize:13,fontWeight:700,color:t.textSoft,background:t.border,borderRadius:4,padding:"1px 5px",lineHeight:"18px"}}>M</span>
              <span style={{fontFamily:F,fontSize:13,color:t.textSoft}}>{cafe.metro}</span>
            </div>
            <div style={{fontFamily:F,fontSize:12,color:t.textMuted}}>{cafe.address}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <button onClick={e=>{e.stopPropagation();toggleFav(cafe.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:isFav(cafe.id)?"#EF4444":t.textMuted}}>
              <HeartIcon filled={isFav(cafe.id)} size={18}/>
            </button>
            <div style={{display:"flex",alignItems:"center",gap:2}}>
              <StarIcon size={12}/><span style={{fontFamily:F,fontSize:12,fontWeight:600,color:t.text}}>{cafe.rating}</span>
            </div>
          </div>
        </div>
        {!compact && (
          <div style={{display:"flex",gap:3,marginTop:12,flexWrap:"wrap"}}>
            {HOURS.map(h => {
              const isSun = cafe.sun[h];
              const sel = h === hour;
              const good = mode==="sun" ? isSun : !isSun;
              return (
                <div key={h} style={{
                  width:28,height:24,borderRadius:6,fontSize:9,fontFamily:F,
                  display:"flex",alignItems:"center",justifyContent:"center",fontWeight:500,
                  background:sel?(good?t.accent:"#EF4444"):(good?t.accentLight:t.border),
                  color:sel?"#FFF":(good?t.accentDark:t.textMuted),
                }}>{h.split(":")[0]}h</div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const wrap: React.CSSProperties = {minHeight:"100vh",background:t.bg,fontFamily:F,maxWidth:430,margin:"0 auto"};

  // ─── HOME ───
  if (page === "home") {
    const kpi = getKpi();
    return (
      <div style={{...wrap,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-120,right:-80,width:300,height:300,borderRadius:"50%",background:t.gradient,opacity:0.12,filter:"blur(50px)"}}/>
        <div style={{padding:"56px 24px 24px",position:"relative"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:44}}>
            <div>
              <div style={{fontSize:28,fontWeight:300,color:t.text,letterSpacing:-0.5,lineHeight:1.1}}>Terrasse</div>
              <div style={{fontSize:28,fontWeight:700,color:t.accent,letterSpacing:-0.5}}>{mode==="sun"?"au soleil":"à l'ombre"}</div>
            </div>
            <ModeToggle/>
          </div>

          {/* KPI – en ce moment */}
          <div style={{display:"flex",gap:12,marginBottom:32}}>
            <div style={{
              flex:1,padding:"16px",borderRadius:14,
              background:"linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
              border:"1px solid #FDE68A",
              textAlign:"center",
            }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
                <SunIcon size={18} color="#D97706"/>
                <span style={{fontSize:24,fontWeight:700,color:"#92400E"}}>{kpi.sunCount}</span>
              </div>
              <div style={{fontSize:12,color:"#92400E",fontWeight:500}}>au soleil</div>
              <div style={{fontSize:10,color:"#B45309",marginTop:2}}>en ce moment ({kpi.hour})</div>
            </div>
            <div style={{
              flex:1,padding:"16px",borderRadius:14,
              background:"linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)",
              border:"1px solid #BFDBFE",
              textAlign:"center",
            }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
                <ShadeIcon size={18} color="#2563EB"/>
                <span style={{fontSize:24,fontWeight:700,color:"#1E40AF"}}>{kpi.shadeCount}</span>
              </div>
              <div style={{fontSize:12,color:"#1E40AF",fontWeight:500}}>à l'ombre</div>
              <div style={{fontSize:10,color:"#1D4ED8",marginTop:2}}>en ce moment ({kpi.hour})</div>
            </div>
          </div>

          <p style={{fontSize:17,color:t.textSoft,fontWeight:300,lineHeight:1.6,marginBottom:36,maxWidth:300}}>
            {mode==="sun"?"Trouve la terrasse parfaite pour profiter du soleil parisien.":"Trouve un coin d'ombre frais pour souffler un peu."}
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:36}}>
            <button onClick={()=>{handleGeo();setPage("search");}} style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              padding:"16px 24px",borderRadius:14,border:"none",cursor:"pointer",
              background:t.gradient,color:"#FFF",fontSize:16,fontWeight:600,fontFamily:F,
              boxShadow:`0 4px 20px ${t.shadow}`,
            }}><CrosshairIcon size={20}/> Autour de moi</button>
            <button onClick={()=>setPage("search")} style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              padding:"16px 24px",borderRadius:14,border:`2px solid ${t.accent}`,cursor:"pointer",
              background:"transparent",color:t.accent,fontSize:16,fontWeight:600,fontFamily:F,
            }}>Choisir un lieu</button>
          </div>
          {favorites.length > 0 && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:13,fontWeight:600,color:t.text,letterSpacing:0.5,textTransform:"uppercase"}}>Mes favoris</span>
                <button onClick={()=>setPage("favorites")} style={{background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:13,color:t.accent,fontWeight:500}}>Voir tout →</button>
              </div>
              <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
                {favorites.slice(0,3).map(fId => {
                  const c = CAFES.find(x => x.id === fId);
                  if (!c) return null;
                  return (
                    <div key={fId} onClick={()=>{setSelectedCafe(c);setPage("detail");}} style={{
                      minWidth:155,background:t.bgCard,borderRadius:12,padding:14,
                      border:`1px solid ${t.border}`,cursor:"pointer",boxShadow:`0 2px 8px ${t.shadow}`,
                    }}>
                      <div style={{fontFamily:F,fontWeight:600,fontSize:14,color:t.text,marginBottom:4}}>{c.name}</div>
                      <div style={{fontFamily:F,fontSize:12,color:t.textMuted}}>{c.metro}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{marginTop:48,textAlign:"center"}}>
            <span style={{fontSize:12,color:t.textMuted}}>Paris uniquement · Données d'ensoleillement simulées</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── SEARCH ───
  if (page === "search") return (
    <div style={wrap}>
      <Nav back title="Recherche"/>
      <div style={{padding:"20px 24px"}}>
        <ModeToggle/>
        <div style={{marginTop:28}}>
          <label style={{fontSize:12,fontWeight:600,color:t.textSoft,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8,display:"block"}}>Lieu</label>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input value={searchLocation} onChange={e=>{setSearchLocation(e.target.value);setMetroOpen(true);}}
                onFocus={()=>setMetroOpen(true)} placeholder="Adresse, station de métro..."
                style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`1.5px solid ${t.border}`,fontFamily:F,fontSize:15,color:t.text,background:t.bgCard,outline:"none",boxSizing:"border-box"}}/>
              {metroOpen && filteredMetro.length > 0 && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:20,background:t.bgCard,borderRadius:12,marginTop:4,border:`1px solid ${t.border}`,boxShadow:`0 8px 24px ${t.shadow}`,maxHeight:200,overflowY:"auto"}}>
                  {filteredMetro.slice(0,8).map(s => (
                    <div key={s} onClick={()=>{setSearchLocation(s);setMetroOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",cursor:"pointer",borderBottom:`1px solid ${t.border}`}}>
                      <span style={{fontFamily:F,fontSize:13,fontWeight:700,color:t.textSoft,background:t.border,borderRadius:4,padding:"1px 5px"}}>M</span>
                      <span style={{fontSize:14,color:t.text,fontFamily:F}}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleGeo} style={{width:48,height:48,borderRadius:12,border:`1.5px solid ${t.border}`,background:t.bgCard,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:geoLocating?t.accent:t.textSoft,flexShrink:0}}>
              {geoLocating ? <div style={{width:18,height:18,border:`2px solid ${t.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> : <CrosshairIcon size={20}/>}
            </button>
          </div>
        </div>
        <div style={{marginTop:24}}>
          <label style={{fontSize:12,fontWeight:600,color:t.textSoft,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8,display:"block"}}>Heure d'arrivée</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {HOURS.map(h => <button key={h} onClick={()=>setSearchHour(h)} style={pillStyle(searchHour===h)}>{h}</button>)}
          </div>
        </div>
        <div style={{marginTop:24}}>
          <label style={{fontSize:12,fontWeight:600,color:t.textSoft,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8,display:"block"}}>Durée souhaitée</label>
          <div style={{display:"flex",gap:6}}>
            {[30,60,120,180].map(d => <button key={d} onClick={()=>setSearchDuration(d)} style={pillStyle(searchDuration===d)}>{d<60?`${d} min`:`${d/60}h`}{d>=120?"+":""}</button>)}
          </div>
        </div>
        <button onClick={()=>{setMetroOpen(false);setPage("results");}} disabled={!searchHour} style={{
          width:"100%",marginTop:36,padding:"16px",borderRadius:14,border:"none",
          background:searchHour?t.gradient:t.border,color:searchHour?"#FFF":t.textMuted,
          fontSize:16,fontWeight:600,fontFamily:F,cursor:searchHour?"pointer":"default",
          boxShadow:searchHour?`0 4px 20px ${t.shadow}`:"none",
        }}>{mode==="sun"?"☀️  Trouver du soleil":"🌤️  Trouver de l'ombre"}</button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ─── RESULTS ───
  if (page === "results") {
    const results = getResults();
    return (
      <div style={wrap}>
        <Nav back title={mode==="sun"?"Terrasses au soleil":"Terrasses à l'ombre"}/>
        <div style={{padding:"12px 24px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:t.accentLight,borderRadius:10,marginBottom:16}}>
            <ClockIcon size={14}/>
            <span style={{fontSize:13,color:t.accentDark,fontWeight:500}}>
              {searchHour||"14:00"} · {searchDuration<60?`${searchDuration} min`:`${searchDuration/60}h`}{searchLocation?` · ${searchLocation}`:""}
            </span>
          </div>
          {results.length === 0 ? (
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:48,marginBottom:16}}>{mode==="sun"?"🌧️":"☀️"}</div>
              <div style={{fontSize:16,color:t.textSoft,fontWeight:500}}>Aucune terrasse {mode==="sun"?"ensoleillée":"ombragée"} trouvée</div>
              <div style={{fontSize:14,color:t.textMuted,marginTop:8}}>Essaye un autre créneau ou un autre lieu.</div>
              <button onClick={()=>setPage("search")} style={{marginTop:20,padding:"12px 24px",borderRadius:10,border:"none",background:t.accent,color:"#FFF",fontSize:14,fontWeight:600,fontFamily:F,cursor:"pointer"}}>Modifier la recherche</button>
            </div>
          ) : (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span style={{fontSize:13,color:t.textMuted}}>{results.length} terrasse{results.length>1?"s":""} trouvée{results.length>1?"s":""}</span>
                {/* View mode toggle */}
                <div style={{display:"flex",gap:2,background:t.border,borderRadius:8,padding:2}}>
                  <button
                    onClick={()=>setViewMode("list")}
                    style={{
                      display:"flex",alignItems:"center",justifyContent:"center",
                      width:34,height:30,borderRadius:6,border:"none",cursor:"pointer",
                      background:viewMode==="list"?t.bgCard:"transparent",
                      color:viewMode==="list"?t.accent:t.textMuted,
                      boxShadow:viewMode==="list"?`0 1px 3px ${t.shadow}`:"none",
                    }}
                    title="Vue liste"
                  >
                    <ListIcon size={16}/>
                  </button>
                  <button
                    onClick={()=>setViewMode("map")}
                    style={{
                      display:"flex",alignItems:"center",justifyContent:"center",
                      width:34,height:30,borderRadius:6,border:"none",cursor:"pointer",
                      background:viewMode==="map"?t.bgCard:"transparent",
                      color:viewMode==="map"?t.accent:t.textMuted,
                      boxShadow:viewMode==="map"?`0 1px 3px ${t.shadow}`:"none",
                    }}
                    title="Vue carte"
                  >
                    <MapPinIcon size={16}/>
                  </button>
                </div>
              </div>

              {viewMode === "map" ? (
                <ResultsMap
                  cafes={results}
                  mode={mode}
                  onCafeClick={(cafe) => { setSelectedCafe(cafe); setPage("detail"); }}
                />
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {results.map(c => <CafeCard key={c.id} cafe={c}/>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── DETAIL ───
  if (page === "detail" && selectedCafe) {
    const c = selectedCafe;
    const hour = searchHour || "14:00";
    const hasSun = c.sun[hour];
    const good = mode==="sun" ? hasSun : !hasSun;
    const slots = HOURS.filter(h => mode==="sun" ? c.sun[h] : !c.sun[h]);
    return (
      <div style={wrap}>
        <Nav back title=""/>
        <div style={{margin:"0 20px 20px",padding:"28px 24px",borderRadius:20,background:t.gradient,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-40,right:-40,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.15)"}}/>
          <div style={{position:"relative"}}>
            <div style={{fontSize:24,fontWeight:700,color:"#FFF",marginBottom:6}}>{c.name}</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontFamily:F,fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.9)",background:"rgba(255,255,255,0.2)",borderRadius:4,padding:"1px 5px"}}>M</span>
              <span style={{fontSize:14,color:"rgba(255,255,255,0.9)"}}>{c.metro}</span>
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{c.address}</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:14}}>
              <span style={{background:"rgba(255,255,255,0.25)",padding:"4px 12px",borderRadius:100,fontSize:13,color:"#FFF",fontWeight:600}}>{c.price}</span>
              <span style={{background:"rgba(255,255,255,0.25)",padding:"4px 12px",borderRadius:100,fontSize:13,color:"#FFF",fontWeight:500}}>{c.vibe}</span>
              <span style={{display:"flex",alignItems:"center",gap:3}}><StarIcon size={13}/><span style={{fontSize:14,fontWeight:700,color:"#FFF"}}>{c.rating}</span></span>
            </div>
          </div>
        </div>
        <div style={{padding:"0 24px 24px"}}>
          <div style={{padding:"14px 18px",borderRadius:14,marginBottom:20,background:good?t.accentLight:"#FEE2E2",border:`1px solid ${good?t.accentLight:"#FECACA"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {mode==="sun"?<SunIcon size={20} color={good?t.accentDark:"#EF4444"}/>:<ShadeIcon size={20} color={good?t.accentDark:"#EF4444"}/>}
              <span style={{fontSize:15,fontWeight:600,color:good?t.accentDark:"#DC2626"}}>
                {good?`${mode==="sun"?"Ensoleillée":"Ombragée"} à ${hour}`:`Pas ${mode==="sun"?"de soleil":"d'ombre"} à ${hour}`}
              </span>
            </div>
          </div>
          <div style={{marginBottom:24}}>
            <span style={{fontSize:12,fontWeight:600,color:t.textSoft,letterSpacing:0.5,textTransform:"uppercase",marginBottom:10,display:"block"}}>Ensoleillement</span>
            <div style={{display:"flex",gap:4}}>
              {HOURS.map(h => {
                const isSun = c.sun[h];
                const now = h === hour;
                return (
                  <div key={h} style={{flex:1,textAlign:"center"}}>
                    <div style={{height:32,borderRadius:6,marginBottom:4,background:isSun?(now?t.accent:t.accentLight):(now?t.textMuted:t.border),display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {isSun?<SunIcon size={11} color={now?"#FFF":t.accentDark}/>:<ShadeIcon size={11} color={now?"#FFF":t.textMuted}/>}
                    </div>
                    <span style={{fontSize:9,color:now?t.accent:t.textMuted,fontWeight:now?700:400}}>{h.split(":")[0]}h</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>toggleFav(c.id)} style={{
              flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              padding:"14px",borderRadius:12,border:`1.5px solid ${isFav(c.id)?"#EF4444":t.border}`,
              background:isFav(c.id)?"#FEF2F2":t.bgCard,cursor:"pointer",
              color:isFav(c.id)?"#EF4444":t.text,fontFamily:F,fontSize:14,fontWeight:500,
            }}><HeartIcon filled={isFav(c.id)} size={18}/> {isFav(c.id)?"Favori":"Ajouter"}</button>
            <button onClick={()=>handleShare(c)} style={{
              flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              padding:"14px",borderRadius:12,border:`1.5px solid ${t.border}`,
              background:t.bgCard,cursor:"pointer",color:t.text,fontFamily:F,fontSize:14,fontWeight:500,
            }}><ShareIcon size={16}/> {shared?"Copié !":"Partager"}</button>
          </div>
          <div style={{marginTop:24,padding:"16px 18px",background:t.bgCard,borderRadius:14,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:12,fontWeight:600,color:t.textSoft,letterSpacing:0.5,textTransform:"uppercase",marginBottom:10}}>Créneaux {mode==="sun"?"ensoleillés":"ombragés"}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {slots.length>0 ? slots.map(h => <span key={h} style={{padding:"6px 14px",borderRadius:100,fontSize:13,fontWeight:500,background:t.accentLight,color:t.accentDark,fontFamily:F}}>{h}</span>) : <span style={{fontSize:13,color:t.textMuted}}>Aucun créneau disponible</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── FAVORITES ───
  if (page === "favorites") {
    const favCafes = CAFES.filter(c => favorites.includes(c.id));
    return (
      <div style={wrap}>
        <Nav back title="Mes favoris"/>
        <div style={{padding:"12px 24px 24px"}}>
          {favCafes.length === 0 ? (
            <div style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:48,marginBottom:16}}>💛</div>
              <div style={{fontSize:16,color:t.textSoft,fontWeight:500}}>Aucun favori pour le moment</div>
              <div style={{fontSize:14,color:t.textMuted,marginTop:8}}>Ajoute tes terrasses préférées ici.</div>
              <button onClick={()=>setPage("home")} style={{marginTop:20,padding:"12px 24px",borderRadius:10,border:"none",background:t.accent,color:"#FFF",fontSize:14,fontWeight:600,fontFamily:F,cursor:"pointer"}}>Explorer</button>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {favCafes.map(c => <CafeCard key={c.id} cafe={c} compact/>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
