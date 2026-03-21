import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useDebounce } from "../hooks/useDebounce";
import { CrosshairIcon, MapPinIcon, PlaceTypeIcon } from "../components/Icons";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import { searchTerrasses as searchTerrassesApi, geocode as geocodeApi } from "../api/terrasses";
import type { TerrasseSearchResult, GeocodeResult } from "../api/types";
import { normalizePlaceType } from "../utils/placeType";
import { F, HOURS, METRO_STATIONS } from "../lib/constants";
import { currentHourKey, todayISO, normalize } from "../lib/helpers";

type SearchType = "address" | "terrasse" | "metro";

export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, th } = useTheme();

  const [searchType, setSearchType] = useState<SearchType>("address");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedTerrasseId, setSelectedTerrasseId] = useState<number | null>(null);
  const [searchHour, setSearchHour] = useState(currentHourKey);
  const [searchDate, setSearchDate] = useState(todayISO());
  const [searchRadius] = useState(200);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [playEasterEgg, setPlayEasterEgg] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

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

  const filteredMetro = useMemo(() => {
    if (searchType !== "metro" || !searchQuery) return METRO_STATIONS.slice(0, 10);
    const q = normalize(searchQuery);
    return METRO_STATIONS.filter((s) => normalize(s).includes(q)).slice(0, 10);
  }, [searchType, searchQuery]);

  const hasDropdownResults =
    (searchType === "terrasse" && terrasseResults && terrasseResults.length > 0) ||
    (searchType === "address" && addressResults && addressResults.length > 0) ||
    (searchType === "metro" && filteredMetro.length > 0);
  const canSearch = !!(selectedTerrasseId || searchCoords);

  const handleGeo = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setSearchQuery(t("common.myPosition"));
        setGeoLocating(false);
      },
      () => setGeoLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [t]);

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
      const sp = new URLSearchParams({ date: searchDate, hour: searchHour, mode });
      navigate(`/terrasse/${selectedTerrasseId}?${sp}`);
    } else if (searchCoords) {
      const sp = new URLSearchParams();
      sp.set("lat", String(searchCoords.lat));
      sp.set("lon", String(searchCoords.lon));
      sp.set("q", searchQuery);
      sp.set("date", searchDate);
      sp.set("hour", searchHour);
      sp.set("radius", String(searchRadius));
      sp.set("mode", mode);
      navigate(`/results?${sp}`);
    }
  }, [selectedTerrasseId, searchCoords, navigate, searchDate, searchHour, mode, searchQuery, searchRadius]);

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 100, border: "none", fontSize: 13,
    fontWeight: active ? 600 : 400, fontFamily: F, cursor: "pointer",
    background: active ? th.accent : th.border, color: active ? "#FFF" : th.textSoft,
    transition: "all 0.2s", whiteSpace: "nowrap",
  });

  const searchTypeTabs: { key: SearchType; label: string; emoji: string }[] = [
    { key: "address", label: t("search.address"), emoji: "\uD83D\uDCCD" },
    { key: "terrasse", label: t("search.terrasse"), emoji: "\uD83C\uDF7A" },
    { key: "metro", label: t("search.metro"), emoji: "\uD83D\uDE87" },
  ];

  const placeholders: Record<SearchType, string> = {
    address: t("search.placeholderAddress"),
    terrasse: t("search.placeholderTerrasse"),
    metro: t("search.placeholderMetro"),
  };

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={wrap}>
      <Nav back title={t("search.title")} onBack={() => navigate(-1)} />
      <div style={{ padding: "20px 24px" }}>

        {/* Search type tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {searchTypeTabs.map(({ key, label, emoji }) => {
            const active = searchType === key;
            return (
              <button key={key} onClick={() => { setSearchType(key); setSearchQuery(""); setDropdownOpen(false); setSelectedTerrasseId(null); setSearchCoords(null); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${active ? th.accent : th.border}`,
                  background: active ? th.accentLight : th.bgCard, cursor: "pointer",
                  fontFamily: F, fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? th.accentDark : th.textSoft, transition: "all 0.2s",
                }}>
                <span>{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Location input */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: th.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
            {searchType === "terrasse" ? t("search.establishment") : searchType === "metro" ? t("search.station") : t("search.address")}
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
                  border: `1.5px solid ${th.border}`, fontFamily: F, fontSize: 16,
                  color: th.text, background: th.bgCard, outline: "none", boxSizing: "border-box",
                }}
              />
              {dropdownOpen && hasDropdownResults && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                  background: th.bgCard, borderRadius: 12, marginTop: 4,
                  border: `1px solid ${th.border}`, boxShadow: `0 8px 24px ${th.shadow}`,
                  maxHeight: 300, overflowY: "auto",
                }}>
                  {/* Terrasse results */}
                  {searchType === "terrasse" && terrasseResults && terrasseResults.length > 0 && (
                    terrasseResults.slice(0, 8).map((tr) => (
                      <div key={tr.id} onClick={() => selectTerrasse(tr)}
                        style={{ display: "flex", flexDirection: "column", padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${th.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <PlaceTypeIcon type={normalizePlaceType(tr.place_type) ?? "autre"} size={14} color={th.textMuted} />
                          <span style={{ fontSize: 14, fontWeight: 500, color: th.text, fontFamily: F }}>{tr.nom_commercial || tr.nom}</span>
                        </div>
                        <span style={{ fontSize: 12, color: th.textMuted, fontFamily: F, marginLeft: 22 }}>{tr.adresse}</span>
                      </div>
                    ))
                  )}

                  {/* Address results */}
                  {searchType === "address" && addressResults && addressResults.length > 0 && (
                    addressResults.slice(0, 8).map((a, i) => (
                      <div key={i} onClick={() => selectAddress(a)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${th.border}` }}>
                        <MapPinIcon size={14} />
                        <span style={{ fontSize: 14, color: th.text, fontFamily: F }}>{a.label}</span>
                      </div>
                    ))
                  )}

                  {/* Metro results */}
                  {searchType === "metro" && filteredMetro.map((station) => (
                    <div key={station} onClick={() => selectMetro(station)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${th.border}` }}>
                      <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: th.textSoft, background: th.border, borderRadius: 4, padding: "1px 5px", lineHeight: "18px" }}>M</span>
                      <span style={{ fontSize: 14, color: th.text, fontFamily: F }}>{station}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleGeo} style={{
              width: 48, height: 48, borderRadius: 12, border: `1.5px solid ${th.border}`,
              background: th.bgCard, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", color: geoLocating ? th.accent : th.textSoft, flexShrink: 0,
            }}>
              {geoLocating
                ? <div style={{ width: 18, height: 18, border: `2px solid ${th.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : <CrosshairIcon size={20} />}
            </button>
          </div>
        </div>

        {/* Date */}
        <div style={{ marginTop: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: th.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
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
                { value: today, label: t("search.today") },
                { value: tomorrow, label: t("search.tomorrow") },
                { value: afterTomorrow, label: t("search.dayAfter") },
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
                      padding: "7px 12px", borderRadius: 100, border: `1.5px solid ${th.border}`,
                      fontFamily: F, fontSize: 13, color: th.text, background: th.bgCard,
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
          <label style={{ fontSize: 12, fontWeight: 600, color: th.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
            {t("search.hour")}
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
          background: canSearch ? th.gradient : th.border, color: canSearch ? "#FFF" : th.textMuted,
          fontSize: 16, fontWeight: 600, fontFamily: F, cursor: canSearch ? "pointer" : "default",
          boxShadow: canSearch ? `0 4px 20px ${th.shadow}` : "none",
        }}>
          {selectedTerrasseId
            ? t("search.viewTimeline")
            : mode === "sun" ? t("search.findSun") : t("search.findShade")}
        </button>
      </div>
      {playEasterEgg && <audio src="/ausoleil.mp3" autoPlay onEnded={() => setPlayEasterEgg(false)} style={{ display: "none" }} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <BottomNav page="search" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
