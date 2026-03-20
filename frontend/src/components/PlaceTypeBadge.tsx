export const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  bar: { label: "Bar", icon: "\uD83C\uDF7A" },
  restaurant: { label: "Restaurant", icon: "\uD83C\uDF7D\uFE0F" },
  cafe: { label: "Café", icon: "\u2615" },
  bakery: { label: "Boulangerie", icon: "\uD83E\uDD50" },
  night_club: { label: "Club", icon: "\uD83C\uDF1F" },
  ice_cream_shop: { label: "Glacier", icon: "\uD83C\uDF66" },
  meal_takeaway: { label: "À emporter", icon: "\uD83E\uDD61" },
};

interface PlaceTypeBadgeProps {
  type: string;
  className?: string;
}

export default function PlaceTypeBadge({ type, className = "" }: PlaceTypeBadgeProps) {
  const config = TYPE_CONFIG[type] || { label: type.replace(/_/g, " "), icon: "\uD83C\uDFE0" };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 ${className}`}
      title={config.label}
    >
      {config.icon} {config.label}
    </span>
  );
}
