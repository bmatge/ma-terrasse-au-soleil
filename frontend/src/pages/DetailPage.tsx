import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useFavorites } from "../hooks/useFavorites";
import { SunIcon, ShadeIcon, HeartIcon, StarIcon, PlaceTypeIcon, MapPinIcon } from "../components/Icons";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import SunMap from "../components/SunMap";
import { getTimeline } from "../api/terrasses";
import { normalizePlaceType } from "../utils/placeType";
import type { TimelineSlot } from "../api/types";
import { F, HOURS, PLACE_TYPE_KEYS } from "../lib/constants";
import { currentHourKey, todayISO, tomorrowISO, isSunnyStatus } from "../lib/helpers";

export default function DetailPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, th } = useTheme();
  const { toggleFav, isFav } = useFavorites();
  const { terrasseId: terrasseIdParam } = useParams<{ terrasseId: string }>();
  const [sp, setSp] = useSearchParams();

  const terrasseId = parseInt(terrasseIdParam || "0");
  const searchDate = sp.get("date") || todayISO();
  const [searchHour, setSearchHour] = useState(sp.get("hour") || currentHourKey());
  const [shared, setShared] = useState(false);
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterMsg, setPosterMsg] = useState(0);
  const posterMsgTimer = useRef<ReturnType<typeof setInterval>>();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const setDate = useCallback((date: string) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (date === todayISO()) {
        next.delete("date");
      } else {
        next.set("date", date);
      }
      return next;
    }, { replace: true });
  }, [setSp]);

  const posterMessages = [
    "Cherche le soleil...",
    "Calcule les ombres...",
    "Mesure les b\u00e2timents...",
    "Met une bi\u00e8re au frais...",
    "Dessine l\u2019affiche...",
  ];

  useEffect(() => {
    if (posterLoading) {
      setPosterMsg(0);
      posterMsgTimer.current = setInterval(() => setPosterMsg((m) => (m + 1) % 5), 1800);
    } else {
      clearInterval(posterMsgTimer.current);
    }
    return () => clearInterval(posterMsgTimer.current);
  }, [posterLoading]);

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["timeline", terrasseId, searchDate],
    queryFn: () => getTimeline(terrasseId, searchDate),
    enabled: !!terrasseId,
  });

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

  const handleShare = useCallback((nom: string, adresse: string | null, id?: number) => {
    const url = id ? `https://ausoleil.app/terrasse/${id}` : "https://ausoleil.app";
    const txt = `${mode === "sun" ? "\u2600\uFE0F" : "\uD83C\uDF24\uFE0F"} ${nom} \u2014 ${adresse || "Paris"}`;
    if (navigator.share) {
      navigator.share({ title: nom, text: txt, url });
    } else {
      navigator.clipboard?.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }, [mode]);

  const handleDownloadPoster = useCallback(async () => {
    setPosterLoading(true);
    try {
      const resp = await fetch(`/api/terrasses/${terrasseId}/poster?t=${Date.now()}`);
      if (!resp.ok) throw new Error("Poster generation failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ausoleil-${terrasseId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setPosterLoading(false);
    }
  }, [terrasseId]);

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  if (timelineLoading || !timelineData) {
    return (
      <div style={wrap}>
        <Nav back title="" onBack={() => navigate(-1)} />
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${th.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <span style={{ fontSize: 14, color: th.textMuted }}>{t("detail.loadingTimeline")}</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <BottomNav page="detail" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
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
      <Nav back title="" onBack={() => navigate(-1)} />

      {/* Hero card */}
      <div style={{ margin: "0 20px 20px", padding: "24px 24px 20px", borderRadius: 20, background: th.gradient, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Left: text info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#FFF", lineHeight: 1.2, marginBottom: 2 }}>{terrasse.nom_commercial || terrasse.nom}</div>
            {terrasse.nom_commercial && terrasse.nom && terrasse.nom_commercial !== terrasse.nom && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>{terrasse.nom}</div>
            )}
            {terrasse.adresse && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 12 }}>{terrasse.adresse}{terrasse.arrondissement ? ` · ${terrasse.arrondissement}` : ""}</div>}

            {/* Meta: type, price, rating + small action icons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {terrasse.place_type && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.95)", background: "rgba(255,255,255,0.18)", borderRadius: 100, padding: "4px 10px", fontFamily: F, fontWeight: 500, whiteSpace: "nowrap" }}>
                  <PlaceTypeIcon type={normalizePlaceType(terrasse.place_type) ?? "autre"} size={13} color="rgba(255,255,255,0.95)" />
                  {t(PLACE_TYPE_KEYS[normalizePlaceType(terrasse.place_type) ?? "autre"])}
                </span>
              )}
              {terrasse.rating != null && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.9)", fontFamily: F }}>
                  <StarIcon size={12} color="rgba(255,255,255,0.9)" />
                  {terrasse.rating.toFixed(1)}{terrasse.user_rating_count ? ` (${terrasse.user_rating_count})` : ""}
                </span>
              )}
              {terrasse.phone && (
                <a href={`tel:${terrasse.phone}`} title={terrasse.phone} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.16 6.16l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </a>
              )}
              {terrasse.website && (
                <a href={terrasse.website} target="_blank" rel="noopener noreferrer" title={t("detail.website")} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Right: big location button */}
          <a href={`https://maps.apple.com/?q=${terrasse.lat},${terrasse.lon}&ll=${terrasse.lat},${terrasse.lon}`} target="_blank" rel="noopener noreferrer" title={t("detail.directions")}
            style={{ width: 62, height: 62, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MapPinIcon size={30} color="#FFF" />
          </a>
        </div>
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        {/* Current status */}
        <div style={{ padding: "14px 18px", borderRadius: 14, marginBottom: 20, background: good ? th.accentLight : "#FEE2E2", border: `1px solid ${good ? th.accentLight : "#FECACA"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mode === "sun" ? <SunIcon size={20} color={good ? th.accentDark : "#EF4444"} /> : <ShadeIcon size={20} color={good ? th.accentDark : "#EF4444"} />}
            <span style={{ fontSize: 15, fontWeight: 600, color: good ? th.accentDark : "#DC2626" }}>
              {good
                ? (mode === "sun" ? t("detail.sunnyAt", { time: selectedHour }) : t("detail.shadedAt", { time: selectedHour }))
                : (mode === "sun" ? t("detail.noSunAt", { time: selectedHour }) : t("detail.noShadeAt", { time: selectedHour }))}
            </span>
          </div>
        </div>

        {/* Best window + météo + UV */}
        <div style={{ padding: "14px 18px", borderRadius: 14, marginBottom: 20, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
          {bestWindow ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontWeight: 600, fontSize: 14, color: "#92400E" }}>
                  <SunIcon size={15} color="#D97706" />
                  {bestWindow.debut} – {bestWindow.fin} · {bestWindow.duree_minutes} min
                </div>
                {currentSlot && currentSlot.uv_index > 0 && (() => {
                  const uv = currentSlot.uv_index;
                  const { label, color } = uv <= 2 ? { label: t("uv.uvLow"), color: "#166534" }
                    : uv <= 5 ? { label: t("uv.uvModerate"), color: "#854D0E" }
                    : uv <= 7 ? { label: t("uv.uvHigh"), color: "#9A3412" }
                    : { label: t("uv.uvVeryHigh"), color: "#991B1B" };
                  return <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: F }}>{uv} · {label}</span>;
                })()}
              </div>
              <div style={{ fontFamily: F, fontSize: 12, color: "#B45309" }}>{timelineData.meteo_resume}</div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: F, fontSize: 13, color: "#B45309" }}>{timelineData.meteo_resume}</div>
              {currentSlot && currentSlot.uv_index > 0 && (() => {
                const uv = currentSlot.uv_index;
                const { label, color } = uv <= 2 ? { label: t("uv.uvLow"), color: "#166534" }
                  : uv <= 5 ? { label: t("uv.uvModerate"), color: "#854D0E" }
                  : uv <= 7 ? { label: t("uv.uvHigh"), color: "#9A3412" }
                  : { label: t("uv.uvVeryHigh"), color: "#991B1B" };
                return <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: F }}>{uv} · {label}</span>;
              })()}
            </div>
          )}
        </div>

        {/* Sun map */}
        <div style={{ marginBottom: 20 }}>
          <SunMap lat={terrasse.lat} lon={terrasse.lon} sunAltitude={currentSlot?.sun_altitude ?? null} sunAzimuth={currentSlot?.sun_azimuth ?? null} />
        </div>

        {/* Hourly slider */}
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: th.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10, display: "block" }}>
            {t("detail.sunlight")}
          </span>
          <div style={{ position: "relative" }}>
            {/* Visual cells */}
            <div style={{ display: "flex", gap: 4, pointerEvents: "none" }}>
              {HOURS.map((h) => {
                const slot = hourlyFromTimeline[h];
                const sunny = slot ? isSunnyStatus(slot.status) : false;
                const isSelected = h === selectedHour;
                return (
                  <div key={h} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      height: 32, borderRadius: 6, marginBottom: 4,
                      background: isSelected ? (sunny ? th.accent : "#EF4444") : (sunny ? th.accentLight : th.border),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      outline: isSelected ? `2px solid ${sunny ? th.accentDark : "#DC2626"}` : "none",
                      outlineOffset: 1,
                    }}>
                      {sunny ? <SunIcon size={11} color={isSelected ? "#FFF" : th.accentDark} /> : <ShadeIcon size={11} color={isSelected ? "#FFF" : th.textMuted} />}
                    </div>
                    <span style={{ fontSize: 9, color: isSelected ? th.accent : th.textMuted, fontWeight: isSelected ? 700 : 400 }}>{h.split(":")[0]}h</span>
                  </div>
                );
              })}
            </div>
            {/* Invisible range input for drag interaction */}
            <input type="range" min={0} max={HOURS.length - 1}
              value={Math.max(0, HOURS.indexOf(selectedHour))}
              onChange={(e) => setSearchHour(HOURS[Number(e.target.value)])}
              style={{ position: "absolute", inset: "0 0 18px 0", width: "100%", opacity: 0, cursor: "pointer", margin: 0 }}
            />
          </div>
        </div>

        {/* Date selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { label: t("detail.today"), value: todayISO() },
            { label: t("detail.tomorrow"), value: tomorrowISO() },
          ].map(({ label, value }) => {
            const active = searchDate === value;
            return (
              <button key={value} onClick={() => setDate(value)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${active ? th.accent : th.border}`,
                  background: active ? th.accentLight : th.bgCard, color: active ? th.accentDark : th.text,
                  fontFamily: F, fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
                }}>
                {label}
              </button>
            );
          })}
          <button onClick={() => dateInputRef.current?.showPicker()}
            style={{
              flex: 1, position: "relative", padding: "10px 0", borderRadius: 10,
              border: `1.5px solid ${searchDate !== todayISO() && searchDate !== tomorrowISO() ? th.accent : th.border}`,
              background: searchDate !== todayISO() && searchDate !== tomorrowISO() ? th.accentLight : th.bgCard,
              color: searchDate !== todayISO() && searchDate !== tomorrowISO() ? th.accentDark : th.text,
              fontFamily: F, fontSize: 13, fontWeight: searchDate !== todayISO() && searchDate !== tomorrowISO() ? 600 : 400,
              cursor: "pointer", overflow: "hidden",
            }}>
            {searchDate !== todayISO() && searchDate !== tomorrowISO()
              ? new Date(searchDate + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })
              : t("detail.pickDate")}
            <input ref={dateInputRef} type="date" value={searchDate}
              onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
            />
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => toggleFav({ id: terrasse.id, nom: terrasse.nom, adresse: terrasse.adresse })}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 12, border: `1.5px solid ${isFav(terrasse.id) ? "#EF4444" : th.border}`,
              background: isFav(terrasse.id) ? "#FEF2F2" : th.bgCard, cursor: "pointer",
              color: isFav(terrasse.id) ? "#EF4444" : th.text, fontFamily: F, fontSize: 14, fontWeight: 500,
            }}>
            <HeartIcon filled={isFav(terrasse.id)} size={17} />
            {isFav(terrasse.id) ? t("detail.removeFavorite") : t("detail.addFavorite")}
          </button>
          <button onClick={() => handleShare(terrasse.nom, terrasse.adresse, terrasse.id)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 12, border: `1.5px solid ${th.border}`,
              background: th.bgCard, cursor: "pointer", color: th.text, fontFamily: F, fontSize: 14, fontWeight: 500,
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            {shared ? t("detail.copied") : t("detail.shareText")}
          </button>
        </div>

        {/* Download poster */}
        <button onClick={handleDownloadPoster} disabled={posterLoading}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px", borderRadius: 12, border: `1.5px solid ${th.accent}`,
            background: th.accentLight, cursor: posterLoading ? "wait" : "pointer",
            color: th.accentDark, fontFamily: F, fontSize: 14, fontWeight: 600,
            marginTop: 10, opacity: posterLoading ? 0.7 : 1,
          }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {posterLoading ? posterMessages[posterMsg] : t("detail.downloadPoster")}
        </button>

      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <BottomNav page="detail" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
