interface PriceLevelProps {
  level: number;
  className?: string;
}

export default function PriceLevel({ level, className = "" }: PriceLevelProps) {
  const filled = Math.min(level, 4);
  const empty = 4 - filled;

  return (
    <span className={`text-xs text-gray-500 ${className}`} title={`Niveau de prix : ${filled}/4`}>
      {"€".repeat(filled)}
      <span className="text-gray-300">{"€".repeat(empty)}</span>
    </span>
  );
}
