import { useTranslation } from "react-i18next";
import { useTheme, themes } from "../contexts/ThemeContext";
import { useFavorites } from "../hooks/useFavorites";
import { HeartIcon, StarIcon, PlaceTypeIcon } from "./Icons";
import StatusBadge from "./StatusBadge";
import { normalizePlaceType } from "../utils/placeType";
import { F, PLACE_TYPE_KEYS } from "../lib/constants";
import { isSunnyStatus } from "../lib/helpers";
import type { NearbyTerrasse } from "../api/types";

interface TerrasseCardProps {
  terrasse: NearbyTerrasse;
  onClick: (terrasse: NearbyTerrasse) => void;
}

export default function TerrasseCard({ terrasse, onClick }: TerrasseCardProps) {
  const { t } = useTranslation();
  const { mode, th } = useTheme();
  const { toggleFav, isFav } = useFavorites();
  const modeMatch = mode === "sun" ? isSunnyStatus(terrasse.status) : !isSunnyStatus(terrasse.status);

  return (
    <div onClick={() => onClick(terrasse)} style={{
      background: th.bgCard, borderRadius: 16, padding: 18, cursor: "pointer",
      border: `1px solid ${modeMatch ? th.accent + "40" : th.border}`,
      boxShadow: `0 2px 12px ${th.shadow}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: F, fontWeight: 600, fontSize: 17, color: th.text }}>{terrasse.nom_commercial || terrasse.nom}</span>
            <StatusBadge status={terrasse.status} />
          </div>
          {terrasse.nom_commercial && terrasse.nom && terrasse.nom_commercial !== terrasse.nom && (
            <div style={{ fontFamily: F, fontSize: 12, color: th.textMuted, marginBottom: 2 }}>{terrasse.nom}</div>
          )}
          {terrasse.adresse && <div style={{ fontFamily: F, fontSize: 13, color: th.textMuted, marginBottom: 4 }}>{terrasse.adresse}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {terrasse.place_type && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: th.textSoft, fontFamily: F }}>
                <PlaceTypeIcon type={normalizePlaceType(terrasse.place_type) ?? "autre"} size={12} color={th.textSoft} />
                {t(PLACE_TYPE_KEYS[normalizePlaceType(terrasse.place_type) ?? "autre"])}
              </span>
            )}
            {terrasse.price_level != null && terrasse.price_level > 0 && (
              <span style={{ fontSize: 11, color: th.textSoft, fontFamily: F }}>{"€".repeat(terrasse.price_level)}</span>
            )}
            {terrasse.rating != null && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: th.textSoft, fontFamily: F }}>
                <StarIcon size={11} />
                {terrasse.rating.toFixed(1)}{terrasse.user_rating_count ? ` (${terrasse.user_rating_count})` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, fontFamily: F, color: th.textSoft }}>
            <span>{terrasse.distance_m}m</span>
            {terrasse.terrasse_count > 1 && <span>{terrasse.terrasse_count} terrasses</span>}
            {terrasse.surface_m2 != null && terrasse.surface_m2 > 0 && <span>{terrasse.surface_m2} m\u00B2</span>}
            {terrasse.soleil_jusqua && <span style={{ color: themes.sun.accentDark }}>{t("detail.sunUntil", { time: terrasse.soleil_jusqua })}</span>}
            {!terrasse.has_profile && <span style={{ color: th.textMuted, fontStyle: "italic" }}>{t("detail.estimated")}</span>}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); toggleFav({ id: terrasse.id, nom: terrasse.nom, adresse: terrasse.adresse }); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: isFav(terrasse.id) ? "#EF4444" : th.textMuted }}>
          <HeartIcon filled={isFav(terrasse.id)} size={18} />
        </button>
      </div>
    </div>
  );
}
