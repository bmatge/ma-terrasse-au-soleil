import { useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { ListIcon, MapPinIcon, PlaceTypeIcon } from "../components/Icons";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import ResultsMap from "../components/ResultsMap";
import TerrasseCard from "../components/TerrasseCard";
import { getNearby } from "../api/terrasses";
import { normalizePlaceType } from "../utils/placeType";
import type { NearbyTerrasse } from "../api/types";
import { F, HOURS, PLACE_TYPE_KEYS } from "../lib/constants";
import { currentHourKey, todayISO, isSunnyStatus } from "../lib/helpers";

type ViewMode = "list" | "map";

export default function ResultsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, th } = useTheme();
  const [sp] = useSearchParams();

  const lat = parseFloat(sp.get("lat") || "");
  const lon = parseFloat(sp.get("lon") || "");
  const [searchDate, setSearchDate] = useState(sp.get("date") || todayISO());
  const [searchHour, setSearchHour] = useState(sp.get("hour") || currentHourKey());
  const [searchRadius, setSearchRadius] = useState(parseInt(sp.get("radius") || "200"));
  const [searchCoords, setSearchCoords] = useState({ lat: isNaN(lat) ? 48.8566 : lat, lon: isNaN(lon) ? 2.3522 : lon });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const datetime = useMemo(() => {
    const hour = searchHour || currentHourKey();
    return `${searchDate}T${hour}:00`;
  }, [searchHour, searchDate]);

  const { data: nearbyData, isLoading: nearbyLoading, isError: nearbyError } = useQuery({
    queryKey: ["nearby", searchCoords.lat, searchCoords.lon, datetime, searchRadius],
    queryFn: () => getNearby(searchCoords.lat, searchCoords.lon, datetime, searchRadius),
    enabled: !isNaN(searchCoords.lat) && !isNaN(searchCoords.lon),
  });

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

  const availableTypes = useMemo(() => {
    if (!results.length) return [];
    const counts: Record<string, number> = {};
    for (const tr of results) {
      const cat = normalizePlaceType(tr.place_type);
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [results]);

  const openDetail = useCallback((terrasse: NearbyTerrasse) => {
    const detailSp = new URLSearchParams({ date: searchDate, hour: searchHour, mode });
    navigate(`/terrasse/${terrasse.id}?${detailSp}`);
  }, [navigate, searchDate, searchHour, mode]);

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={wrap}>
      <Nav back title={mode === "sun" ? t("results.sunTerraces") : t("results.shadeTerraces")} onBack={() => navigate(-1)} />
      <div style={{ padding: "12px 24px 24px" }}>
        {/* API error */}
        {nearbyError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FEF2F2", borderRadius: 10, marginBottom: 12, border: "1px solid #FECACA" }}>
            <span>⚠️</span>
            <span style={{ fontFamily: F, fontSize: 13, color: "#DC2626" }}>{t("results.serviceUnavailable")}</span>
          </div>
        )}

        {/* Date picker */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => { const d = new Date(searchDate + "T12:00:00"); d.setDate(d.getDate() - 1); setSearchDate(d.toISOString().split("T")[0]); }}
            style={{ background: "none", border: `1.5px solid ${th.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: F, fontSize: 13, color: th.textSoft }}>
            ←
          </button>
          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: th.text, textTransform: "capitalize" }}>
            {searchDate === todayISO() ? t("search.today") : searchDate === (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })() ? t("search.tomorrow") : new Date(searchDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            {nearbyData && ` · ${nearbyData.meteo.status === "degage" ? "\u2600\uFE0F" : nearbyData.meteo.status === "mitige" ? "\uD83C\uDF24\uFE0F" : "\u2601\uFE0F"}`}
            {nearbyData && nearbyData.meteo.uv_index > 0 && (() => {
              const uv = nearbyData.meteo.uv_index;
              const { color, bg } = uv <= 2
                ? { color: "#166534", bg: "#DCFCE7" }
                : uv <= 5 ? { color: "#854D0E", bg: "#FEF9C3" }
                : uv <= 7 ? { color: "#9A3412", bg: "#FFEDD5" }
                : uv <= 10 ? { color: "#991B1B", bg: "#FEE2E2" }
                : { color: "#581C87", bg: "#F3E8FF" };
              return (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, color, background: bg, fontFamily: F, verticalAlign: "middle" }}>
                  UV {uv}
                </span>
              );
            })()}
          </span>
          <button onClick={() => { const d = new Date(searchDate + "T12:00:00"); d.setDate(d.getDate() + 1); setSearchDate(d.toISOString().split("T")[0]); }}
            style={{ background: "none", border: `1.5px solid ${th.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: F, fontSize: 13, color: th.textSoft }}>
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
                  border: `1.5px solid ${active ? th.accent : th.border}`,
                  background: active ? th.accent : th.bgCard,
                  color: active ? "#FFF" : th.textSoft,
                }}>{h}</button>
              );
            })}
          </div>
          {/* Radius + view toggle on one line */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {([200, 500] as const).map((r) => {
                const active = searchRadius === r;
                return (
                  <button key={r} onClick={() => setSearchRadius(r)} style={{
                    padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: F,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    border: `1.5px solid ${active ? th.accent : th.border}`,
                    background: active ? th.accent : th.bgCard,
                    color: active ? "#FFF" : th.textSoft,
                  }}>{r} m</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 2, background: th.border, borderRadius: 10, padding: 3 }}>
              <button onClick={() => setViewMode("list")} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
                border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: viewMode === "list" ? 600 : 400,
                background: viewMode === "list" ? th.bgCard : "transparent",
                color: viewMode === "list" ? th.accent : th.textMuted,
                boxShadow: viewMode === "list" ? `0 1px 3px ${th.shadow}` : "none",
              }}><ListIcon size={14} /> {t("results.list")}</button>
              <button onClick={() => setViewMode("map")} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7,
                border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: viewMode === "map" ? 600 : 400,
                background: viewMode === "map" ? th.bgCard : "transparent",
                color: viewMode === "map" ? th.accent : th.textMuted,
                boxShadow: viewMode === "map" ? `0 1px 3px ${th.shadow}` : "none",
              }}><MapPinIcon size={14} /> {t("results.map")}</button>
            </div>
          </div>
        </div>

        {nearbyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 80, background: th.border, borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{mode === "sun" ? "\uD83C\uDF27\uFE0F" : "\u2600\uFE0F"}</div>
            <div style={{ fontSize: 16, color: th.textSoft, fontWeight: 500 }}>{mode === "sun" ? t("results.noSunTerraces") : t("results.noShadeTerraces")}</div>
            <div style={{ fontSize: 14, color: th.textMuted, marginTop: 8 }}>{t("results.tryAnother")}</div>
            <button onClick={() => navigate("/search")} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "none", background: th.accent, color: "#FFF", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>
              {t("results.editSearch")}
            </button>
          </div>
        ) : (
          <div>
            {/* Type filter pills */}
            {availableTypes.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
                <button onClick={() => setTypeFilter(null)} style={{
                  padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontFamily: F,
                  fontSize: 13, fontWeight: typeFilter === null ? 600 : 400, whiteSpace: "nowrap",
                  border: `1.5px solid ${typeFilter === null ? th.accent : th.border}`,
                  background: typeFilter === null ? th.accentLight : "transparent",
                  color: typeFilter === null ? th.accentDark : th.textMuted,
                }}>{t("results.all")} ({results.length})</button>
                {availableTypes.map(({ type, count }) => {
                  const cfgKey = PLACE_TYPE_KEYS[type];
                  const cfg = { label: cfgKey ? t(cfgKey) : type.replace(/_/g, " ") };
                  const active = typeFilter === type;
                  return (
                    <button key={type} onClick={() => setTypeFilter(active ? null : type)} style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontFamily: F,
                      fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
                      border: `1.5px solid ${active ? th.accent : th.border}`,
                      background: active ? th.accentLight : "transparent",
                      color: active ? th.accentDark : th.textMuted,
                    }}>
                      <PlaceTypeIcon type={type} size={13} color={active ? th.accentDark : th.textMuted} />
                      {cfg.label} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode === "map" ? (
              <ResultsMap terrasses={results.filter(r => !typeFilter || normalizePlaceType(r.place_type) === typeFilter)} mode={mode} onTerrasseClick={openDetail} onCenterChange={(lat, lon) => setSearchCoords({ lat, lon })} />
            ) : (
              <div className="terrasse-grid">
                {results.filter(r => !typeFilter || normalizePlaceType(r.place_type) === typeFilter).map((tr) => <TerrasseCard key={tr.id} terrasse={tr} onClick={openDetail} />)}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav page="results" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
