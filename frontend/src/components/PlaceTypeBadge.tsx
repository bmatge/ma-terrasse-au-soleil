import { useTranslation } from "react-i18next";
import { normalizePlaceType } from "../utils/placeType";

export const TYPE_CONFIG: Record<string, { labelKey: string; icon: string }> = {
  restaurant: { labelKey: "placeType.restaurant", icon: "🍽️" },
  cafe: { labelKey: "placeType.cafe", icon: "☕" },
  autre: { labelKey: "placeType.autre", icon: "🏠" },
};

interface PlaceTypeBadgeProps {
  type: string;
  className?: string;
}

export default function PlaceTypeBadge({ type, className = "" }: PlaceTypeBadgeProps) {
  const { t } = useTranslation();
  const normalized = normalizePlaceType(type) ?? "autre";
  const config = TYPE_CONFIG[normalized];
  const label = t(config.labelKey);
  const icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 ${className}`}
      title={label}
    >
      {icon} {label}
    </span>
  );
}
