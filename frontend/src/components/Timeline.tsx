import type { TimelineSlot, BestWindow } from "../api/types";

const STATUS_COLORS: Record<string, string> = {
  soleil: "bg-amber-400",
  mitige: "bg-yellow-300",
  couvert: "bg-gray-300",
  ombre_batiment: "bg-gray-500",
  nuit: "bg-slate-800",
};

const STATUS_LABELS: Record<string, string> = {
  soleil: "Soleil",
  mitige: "Mitigé",
  couvert: "Couvert",
  ombre_batiment: "Ombre",
  nuit: "Nuit",
};

interface TimelineProps {
  slots: TimelineSlot[];
  bestWindow: BestWindow | null;
  meteoResume: string;
  onSlotHover?: (time: string) => void;
}

export default function Timeline({ slots, bestWindow, meteoResume, onSlotHover }: TimelineProps) {
  // Group slots into hours for labels
  const hours = [...new Set(slots.map((s) => s.time.split(":")[0]))];

  return (
    <div>
      {/* Best window banner */}
      {bestWindow && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="font-semibold text-amber-800">
            Meilleur créneau : {bestWindow.debut} – {bestWindow.fin}
          </div>
          <div className="text-sm text-amber-600">
            {bestWindow.duree_minutes} min de soleil + ciel dégagé
          </div>
        </div>
      )}

      {/* Weather summary */}
      <div className="text-sm text-gray-500 mb-3">{meteoResume}</div>

      {/* Timeline bar */}
      <div className="relative">
        <div className="flex h-10 rounded-lg overflow-hidden border border-gray-200">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={`flex-1 ${STATUS_COLORS[slot.status] || "bg-gray-200"} relative group cursor-pointer`}
              title={`${slot.time} — ${STATUS_LABELS[slot.status] || slot.status}`}
              onMouseEnter={() => onSlotHover?.(slot.time)}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {slot.time} — {STATUS_LABELS[slot.status]}
                  {slot.cloud_cover > 0 && ` (${slot.cloud_cover}% nuages)`}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hour labels */}
        <div className="flex mt-1">
          {hours.map((h) => {
            const idx = slots.findIndex((s) => s.time.startsWith(h + ":"));
            const pct = (idx / slots.length) * 100;
            return (
              <div
                key={h}
                className="text-xs text-gray-400 absolute"
                style={{ left: `${pct}%` }}
              >
                {h}h
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-6 text-xs text-gray-600">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${color}`} />
            <span>{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
