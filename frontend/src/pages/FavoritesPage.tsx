import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useFavorites } from "../hooks/useFavorites";
import { HeartIcon } from "../components/Icons";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import { F } from "../lib/constants";
import { currentHourKey, todayISO } from "../lib/helpers";

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, th } = useTheme();
  const { favorites, toggleFav } = useFavorites();

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={wrap}>
      <Nav back title={t("favorites.title")} onBack={() => navigate(-1)} />
      <div style={{ padding: "12px 24px 24px" }}>
        {favorites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💛</div>
            <div style={{ fontSize: 16, color: th.textSoft, fontWeight: 500 }}>{t("favorites.empty")}</div>
            <div style={{ fontSize: 14, color: th.textMuted, marginTop: 8 }}>{t("favorites.emptyHint")}</div>
            <button onClick={() => navigate("/")} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "none", background: th.accent, color: "#FFF", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>
              {t("favorites.explore")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {favorites.map((fav) => (
              <div key={fav.id} onClick={() => {
                const sp = new URLSearchParams({ date: todayISO(), hour: currentHourKey(), mode });
                navigate(`/terrasse/${fav.id}?${sp}`);
              }}
                style={{
                  background: th.bgCard, borderRadius: 16, padding: 18, cursor: "pointer",
                  border: `1px solid ${th.border}`, boxShadow: `0 2px 12px ${th.shadow}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                <div>
                  <div style={{ fontFamily: F, fontWeight: 600, fontSize: 16, color: th.text, marginBottom: 4 }}>{fav.nom}</div>
                  <div style={{ fontFamily: F, fontSize: 13, color: th.textMuted }}>{fav.adresse || ""}</div>
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
      <BottomNav page="favorites" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
