import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NearbyTerrasse } from "../api/types";
import PriceLevel from "./PriceLevel";
import PlaceTypeBadge from "./PlaceTypeBadge";
import Rating from "./Rating";

interface TerrasseCardProps {
  terrasse: NearbyTerrasse;
}

export default function TerrasseCard({ terrasse }: TerrasseCardProps) {
  const { t } = useTranslation();

  const STATUS_CONFIG: Record<string, { icon: string; color: string; labelKey: string }> = {
    soleil: { icon: "\u2600\uFE0F", color: "text-amber-600", labelKey: "status.soleil" },
    mitige: { icon: "\u26C5", color: "text-yellow-600", labelKey: "status.mitige" },
    couvert: { icon: "\u2601\uFE0F", color: "text-gray-500", labelKey: "status.couvert" },
    ombre: { icon: "\uD83C\uDFE2", color: "text-gray-600", labelKey: "status.ombre" },
    nuit: { icon: "\uD83C\uDF19", color: "text-slate-600", labelKey: "status.nuit" },
  };

  const config = STATUS_CONFIG[terrasse.status] || STATUS_CONFIG.ombre;

  return (
    <Link
      to={`/terrasse/${terrasse.id}`}
      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-amber-200 hover:shadow-sm transition"
    >
      <div className="text-2xl">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">{terrasse.nom_commercial || terrasse.nom}</div>
        <div className="text-sm text-gray-500 truncate">
          {terrasse.adresse}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {terrasse.place_type && (
            <PlaceTypeBadge type={terrasse.place_type} />
          )}
          {terrasse.price_level != null && terrasse.price_level > 0 && (
            <PriceLevel level={terrasse.price_level} />
          )}
          {terrasse.rating != null && (
            <Rating rating={terrasse.rating} count={terrasse.user_rating_count} />
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-medium ${config.color}`}>
          {t(config.labelKey)}
        </div>
        <div className="text-xs text-gray-400">{terrasse.distance_m}m</div>
        {terrasse.soleil_jusqua && (
          <div className="text-xs text-amber-500">
            {t("detail.sunUntil", { time: terrasse.soleil_jusqua })}
          </div>
        )}
      </div>
    </Link>
  );
}
