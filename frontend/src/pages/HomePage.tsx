import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useFavorites } from "../hooks/useFavorites";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { SunIcon, ShadeIcon, MapPinIcon } from "../components/Icons";
import ModeToggle from "../components/ModeToggle";
import LanguageSelector from "../components/LanguageSelector";
import BottomNav from "../components/BottomNav";
import UpdatePrompt from "../components/UpdatePrompt";
import { getNearby } from "../api/terrasses";
import { F, KPI_STATIONS } from "../lib/constants";
import { currentHourKey, todayISO, isSunnyStatus } from "../lib/helpers";

type FunFact = { fact: string };
const FUN_FACTS_LOADERS: Record<string, () => Promise<{ default: FunFact[] }>> = {
  fr: () => import("../data/funFacts.json"),
  en: () => import("../data/funFacts_en.json"),
  es: () => import("../data/funFacts_es.json"),
  de: () => import("../data/funFacts_de.json"),
  ja: () => import("../data/funFacts_ja.json"),
  zh: () => import("../data/funFacts_zh.json"),
};

export default function HomePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { mode, th } = useTheme();
  const { favorites } = useFavorites();

  const { canShow: canShowInstall, platform: installPlatform, triggerInstall, dismiss: dismissInstall } = usePWAInstall();
  const [kpiStationIndex, setKpiStationIndex] = useState(() => Math.floor(Math.random() * KPI_STATIONS.length));
  const [geoLocating, setGeoLocating] = useState(false);
  const [shared, setShared] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [funFacts, setFunFacts] = useState<FunFact[]>([]);
  const [funFactIndex, setFunFactIndex] = useState(0);

  useEffect(() => {
    const lang = i18n.language?.split("-")[0] || "fr";
    const loader = FUN_FACTS_LOADERS[lang] || FUN_FACTS_LOADERS.fr;
    loader().then((mod) => {
      setFunFacts(mod.default);
      setFunFactIndex(Math.floor(Math.random() * mod.default.length));
    });
  }, [i18n.language]);
  const safeFunFactIndex = funFacts.length ? funFactIndex % funFacts.length : 0;

  const kpiStation = KPI_STATIONS[kpiStationIndex];
  const { data: homeData } = useQuery({
    queryKey: ["home-nearby", kpiStation.name, todayISO(), currentHourKey()],
    queryFn: () => getNearby(kpiStation.lat, kpiStation.lon, `${todayISO()}T${currentHourKey()}:00`, 500),
    staleTime: 5 * 60 * 1000,
  });

  const kpi = useMemo(() => {
    const hour = currentHourKey();
    const station = kpiStation.name;
    if (!homeData) return { sunCount: "...", shadeCount: "...", hour, station };
    const sunCount = homeData.terrasses.filter((tr) => isSunnyStatus(tr.status)).length;
    const shadeCount = homeData.terrasses.length - sunCount;
    return { sunCount, shadeCount, hour, station };
  }, [homeData, kpiStation.name]);

  const handleGeoAndSearch = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const h = Math.max(9, Math.min(19, new Date().getHours()));
        const hour = `${h.toString().padStart(2, "0")}:00`;
        setGeoLocating(false);
        const sp = new URLSearchParams();
        sp.set("lat", String(lat));
        sp.set("lon", String(lon));
        sp.set("q", t("common.myPosition"));
        sp.set("date", todayISO());
        sp.set("hour", hour);
        sp.set("radius", "200");
        sp.set("mode", mode);
        navigate(`/results?${sp}`);
      },
      () => setGeoLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [navigate, mode, t]);

  const handleShare = useCallback((nom: string, tagline: string) => {
    const url = "https://ausoleil.app";
    const txt = `${mode === "sun" ? "\u2600\uFE0F" : "\uD83C\uDF24\uFE0F"} ${nom} \u2014 ${tagline}`;
    if (navigator.share) {
      navigator.share({ title: nom, text: txt, url });
    } else {
      navigator.clipboard?.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }, [mode]);

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={{ ...wrap, position: "relative", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 24px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {mode === "sun"
              ? <SunIcon size={32} color={th.accent} />
              : <ShadeIcon size={32} color={th.accent} />}
            <div>
              <div style={{ fontSize: 22, fontWeight: 300, color: th.text, letterSpacing: -0.5, lineHeight: 1.1 }}>{t("home.terrasse")}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: th.accent, letterSpacing: -0.5 }}>
                {mode === "sun" ? t("home.auSoleil") : t("home.aLombre")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <ModeToggle />
            <LanguageSelector />
          </div>
        </div>

        <p style={{ fontSize: 15, color: th.textSoft, fontWeight: 300, fontStyle: "italic", lineHeight: 1.4, marginBottom: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {mode === "sun" ? t("home.subtitleSun") : t("home.subtitleShade")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          <button onClick={handleGeoAndSearch} disabled={geoLocating} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 24px", borderRadius: 14, border: "none",
            cursor: geoLocating ? "wait" : "pointer", background: th.gradient,
            color: "#FFF", fontSize: 16, fontWeight: 600, fontFamily: F,
            boxShadow: `0 4px 20px ${th.shadow}`, opacity: geoLocating ? 0.7 : 1,
          }}>
            {geoLocating
              ? <div style={{ width: 18, height: 18, border: "2px solid #FFF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              : <MapPinIcon size={18} color="#FFF" />}
            {geoLocating ? t("home.locating") : t("home.aroundMe")}
          </button>
          <button onClick={() => navigate("/search")} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 24px", borderRadius: 14, border: `2px solid ${th.accent}`,
            cursor: "pointer", background: "transparent", color: th.accent,
            fontSize: 16, fontWeight: 600, fontFamily: F,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            {t("home.choosePlace")}
          </button>
        </div>

        {/* KPI */}
        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <img src="/logo.webp" alt="" aria-hidden="true" fetchPriority="high" style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            height: "200%", width: "auto",
            opacity: 0.5, pointerEvents: "none", userSelect: "none",
          }} />
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: mode === "sun" ? "rgba(180,83,9,0.18)" : "rgba(29,78,216,0.18)",
            mixBlendMode: "multiply",
          }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <button aria-label={t("common.previousStation")} onClick={() => setKpiStationIndex((i) => (i - 1 + KPI_STATIONS.length) % KPI_STATIONS.length)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>
              <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 7L7 1L13 7" stroke={th.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ fontFamily: F, fontSize: 13, color: th.textSoft, fontWeight: 700, padding: "2px 0", whiteSpace: "nowrap" }}>
              {t("home.at")} {kpi.station}
            </span>
            <span style={{ fontFamily: F, fontSize: 11, color: th.textMuted, fontWeight: 600 }}>
              {kpi.hour}
            </span>
            <button aria-label={t("common.nextStation")} onClick={() => setKpiStationIndex((i) => (i + 1) % KPI_STATIONS.length)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>
              <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 1L7 7L13 1" stroke={th.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1, padding: "28px 32px 28px 16px", textAlign: "left", background: "rgba(254, 243, 199, 0.65)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 6, marginBottom: 4 }}>
                <SunIcon size={18} color="#D97706" />
                <span style={{ fontSize: 28, fontWeight: 700, color: "#92400E", fontFamily: F }}>{kpi.sunCount}</span>
              </div>
              <div style={{ fontSize: 12, color: "#92400E", fontFamily: F }}>{kpi.sunCount !== "..." && Number(kpi.sunCount) > 1 ? t("home.terrasse_other") : t("home.terrasse_one")}</div>
              <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600, fontFamily: F }}>{t("home.terrasseSun")}</div>
            </div>
            <div style={{ flex: 1, padding: "28px 16px 28px 32px", textAlign: "right", background: "rgba(243, 244, 246, 0.65)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 4 }}>
                <ShadeIcon size={18} color="#6B7280" />
                <span style={{ fontSize: 28, fontWeight: 700, color: "#374151", fontFamily: F }}>{kpi.shadeCount}</span>
              </div>
              <div style={{ fontSize: 12, color: "#4B5563", fontFamily: F }}>{kpi.shadeCount !== "..." && Number(kpi.shadeCount) > 1 ? t("home.terrasse_other") : t("home.terrasse_one")}</div>
              <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, fontFamily: F }}>{t("home.terrasseShade")}</div>
            </div>
          </div>
        </div>

        {favorites.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: th.text, letterSpacing: 0.5, textTransform: "uppercase" }}>{t("home.myFavorites")}</span>
              <button onClick={() => navigate("/favorites")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, color: th.accent, fontWeight: 500 }}>{t("home.viewAll")}</button>
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
              {favorites.slice(0, 3).map((fav) => (
                <div key={fav.id} onClick={() => {
                  const sp = new URLSearchParams({ date: todayISO(), hour: currentHourKey(), mode });
                  navigate(`/terrasse/${fav.id}?${sp}`);
                }}
                  style={{ minWidth: 155, background: th.bgCard, borderRadius: 12, padding: 14, border: `1px solid ${th.border}`, cursor: "pointer", boxShadow: `0 2px 8px ${th.shadow}` }}>
                  <div style={{ fontFamily: F, fontWeight: 600, fontSize: 14, color: th.text, marginBottom: 4 }}>{fav.nom}</div>
                  <div style={{ fontFamily: F, fontSize: 12, color: th.textMuted }}>{fav.adresse || ""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 40 }}>
          <button onClick={() => handleShare("Au Soleil", t("app.tagline"))} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
            cursor: "pointer", fontFamily: F, fontSize: 13, color: th.textMuted, padding: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            {shared ? t("home.linkCopied") : t("home.share")}
          </button>
          {canShowInstall && (
            <button onClick={() => {
              if (installPlatform === "android") triggerInstall();
              else setShowInstall(true);
            }} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              cursor: "pointer", fontFamily: F, fontSize: 13, color: th.textMuted, padding: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t("home.installApp")}
            </button>
          )}
        </div>

        {funFacts.length > 0 && (
        <div
          onClick={() => setFunFactIndex((i) => (i + 1) % funFacts.length)}
          style={{ marginTop: 16, padding: "14px 18px", background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, cursor: "pointer", textAlign: "center" }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: th.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{t("home.didYouKnow")}</div>
          <div style={{ fontSize: 13, color: th.textSoft, lineHeight: 1.5, fontFamily: F }}>{funFacts[safeFunFactIndex].fact}</div>
          <div style={{ fontSize: 11, color: th.textMuted, marginTop: 8 }}>{t("home.tapForAnother")}</div>
        </div>
        )}
      </div>

      <UpdatePrompt />
      {/* PWA Install Modal — iOS instructions (Android uses native prompt) */}
      {showInstall && (
        <div onClick={() => { setShowInstall(false); dismissInstall(); }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#FFF", borderRadius: "20px 20px 0 0", padding: "28px 24px 36px",
            width: "100%", maxWidth: 440, maxHeight: "80vh", overflowY: "auto",
            boxShadow: "0 -4px 30px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: F, color: "#1C1917" }}>{t("home.installTitle")}</span>
              <button onClick={() => { setShowInstall(false); dismissInstall(); }} style={{
                background: "#F5F5F4", border: "none", borderRadius: "50%", width: 32, height: 32,
                cursor: "pointer", fontSize: 18, color: "#78716C", display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
            <p style={{ fontSize: 14, color: "#57534E", lineHeight: 1.5, fontFamily: F, margin: "0 0 20px" }}>
              {t("home.installDescription")}
            </p>

            {installPlatform === "ios" && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: F, color: "#1C1917", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" fill="#1C1917"/><path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" fill="#1C1917"/></svg>
                  iPhone / iPad
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#57534E", fontFamily: F, lineHeight: 1.8 }}>
                  <li>{t("home.iosSteps1")}</li>
                  <li>{t("home.iosSteps2")} <span style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", background: "#F5F5F4", borderRadius: 4, padding: "1px 4px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#57534E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </span></li>
                  <li>{t("home.iosSteps3")}</li>
                </ol>
              </div>
            )}

            {installPlatform === "android" && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: F, color: "#1C1917", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17.523 2H6.477C5.768 2 5.2 2.768 5.2 3.477v17.046C5.2 21.232 5.768 22 6.477 22h11.046c.709 0 1.277-.768 1.277-1.477V3.477C18.8 2.768 18.232 2 17.523 2z" fill="none" stroke="#1C1917" strokeWidth="1.5"/><path d="M3.064 7.044l3.57 2.236 2.578-4.316L12.784 9.3l2.578-4.316 2.578 4.316 2.932-1.836" stroke="#34A853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="12" cy="15" r="4" fill="none" stroke="#4285F4" strokeWidth="1.5"/><path d="M8 15h8" stroke="#EA4335" strokeWidth="1.5"/><path d="M12 11v8" stroke="#FBBC05" strokeWidth="1.5"/></svg>
                  Android
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#57534E", fontFamily: F, lineHeight: 1.8 }}>
                  <li>{t("home.androidSteps1")}</li>
                  <li>{t("home.androidSteps2")}</li>
                  <li>{t("home.androidSteps3")}</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <BottomNav page="home" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
