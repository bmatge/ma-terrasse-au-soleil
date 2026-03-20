import { useTranslation } from "react-i18next";

interface UvBadgeProps {
  uvIndex: number;
  className?: string;
}

export default function UvBadge({ uvIndex, className = "" }: UvBadgeProps) {
  const { t } = useTranslation();

  function uvLevel(uv: number): { label: string; color: string; bg: string } {
    if (uv <= 2) return { label: t("uv.low"), color: "text-green-700", bg: "bg-green-100" };
    if (uv <= 5) return { label: t("uv.moderate"), color: "text-yellow-700", bg: "bg-yellow-100" };
    if (uv <= 7) return { label: t("uv.high"), color: "text-orange-700", bg: "bg-orange-100" };
    if (uv <= 10) return { label: t("uv.veryHigh"), color: "text-red-700", bg: "bg-red-100" };
    return { label: t("uv.extreme"), color: "text-purple-700", bg: "bg-purple-100" };
  }

  const { label, color, bg } = uvLevel(uvIndex);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${bg} ${color} ${className}`}>
      UV {uvIndex} — {label}
    </span>
  );
}
