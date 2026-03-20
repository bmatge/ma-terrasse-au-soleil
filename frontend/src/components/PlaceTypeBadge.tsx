import { useTranslation } from "react-i18next";

export const TYPE_CONFIG: Record<string, { labelKey: string; icon: string }> = {
  bar: { labelKey: "placeType.bar", icon: "\uD83C\uDF7A" },
  restaurant: { labelKey: "placeType.restaurant", icon: "\uD83C\uDF7D\uFE0F" },
  cafe: { labelKey: "placeType.cafe", icon: "\u2615" },
  bakery: { labelKey: "placeType.bakery", icon: "\uD83E\uDD50" },
  night_club: { labelKey: "placeType.night_club", icon: "\uD83C\uDF1F" },
  ice_cream_shop: { labelKey: "placeType.ice_cream_shop", icon: "\uD83C\uDF66" },
  meal_takeaway: { labelKey: "placeType.meal_takeaway", icon: "\uD83E\uDD61" },
};

interface PlaceTypeBadgeProps {
  type: string;
  className?: string;
}

export default function PlaceTypeBadge({ type, className = "" }: PlaceTypeBadgeProps) {
  const { t } = useTranslation();
  const config = TYPE_CONFIG[type];
  const label = config ? t(config.labelKey) : type.replace(/_/g, " ");
  const icon = config?.icon ?? "\uD83C\uDFE0";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 ${className}`}
      title={label}
    >
      {icon} {label}
    </span>
  );
}
