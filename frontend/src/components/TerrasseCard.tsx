import { Link } from "react-router-dom";
import type { NearbyTerrasse } from "../api/types";

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  soleil: { icon: "\u2600\uFE0F", color: "text-amber-600", label: "Au soleil" },
  mitige: { icon: "\u26C5", color: "text-yellow-600", label: "Mitigé" },
  couvert: { icon: "\u2601\uFE0F", color: "text-gray-500", label: "Couvert" },
  ombre: { icon: "\uD83C\uDFE2", color: "text-gray-600", label: "À l'ombre" },
  nuit: { icon: "\uD83C\uDF19", color: "text-slate-600", label: "Nuit" },
};

interface TerrasseCardProps {
  terrasse: NearbyTerrasse;
}

export default function TerrasseCard({ terrasse }: TerrasseCardProps) {
  const config = STATUS_CONFIG[terrasse.status] || STATUS_CONFIG.ombre;

  return (
    <Link
      to={`/terrasse/${terrasse.id}`}
      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-amber-200 hover:shadow-sm transition"
    >
      <div className="text-2xl">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">{terrasse.nom}</div>
        <div className="text-sm text-gray-500 truncate">{terrasse.adresse}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </div>
        <div className="text-xs text-gray-400">{terrasse.distance_m}m</div>
        {terrasse.soleil_jusqua && (
          <div className="text-xs text-amber-500">
            jusqu'à {terrasse.soleil_jusqua}
          </div>
        )}
      </div>
    </Link>
  );
}
