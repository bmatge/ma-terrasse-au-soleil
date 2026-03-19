interface RatingProps {
  rating: number;
  count?: number | null;
  className?: string;
}

export default function Rating({ rating, count, className = "" }: RatingProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-gray-600 ${className}`}>
      <span className="text-amber-500">{"\u2B50"}</span>
      <span className="font-medium">{rating.toFixed(1)}</span>
      {count != null && (
        <span className="text-gray-400">({count})</span>
      )}
    </span>
  );
}
