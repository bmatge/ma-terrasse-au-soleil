interface UvBadgeProps {
  uvIndex: number;
  className?: string;
}

function uvLevel(uv: number): { label: string; color: string; bg: string } {
  if (uv <= 2) return { label: "Faible", color: "text-green-700", bg: "bg-green-100" };
  if (uv <= 5) return { label: "Modéré", color: "text-yellow-700", bg: "bg-yellow-100" };
  if (uv <= 7) return { label: "Fort", color: "text-orange-700", bg: "bg-orange-100" };
  if (uv <= 10) return { label: "Très fort", color: "text-red-700", bg: "bg-red-100" };
  return { label: "Extrême", color: "text-purple-700", bg: "bg-purple-100" };
}

export default function UvBadge({ uvIndex, className = "" }: UvBadgeProps) {
  const { label, color, bg } = uvLevel(uvIndex);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${bg} ${color} ${className}`}>
      UV {uvIndex} — {label}
    </span>
  );
}
