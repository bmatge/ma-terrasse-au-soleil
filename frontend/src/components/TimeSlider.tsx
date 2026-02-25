import { useMemo } from "react";

interface TimeSliderProps {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  min?: string; // "HH:MM" default "07:00"
  max?: string; // "HH:MM" default "22:00"
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

export default function TimeSlider({
  value,
  onChange,
  min = "07:00",
  max = "22:00",
}: TimeSliderProps) {
  const minMinutes = useMemo(() => timeToMinutes(min), [min]);
  const maxMinutes = useMemo(() => timeToMinutes(max), [max]);
  const valueMinutes = timeToMinutes(value);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 w-12">{min}</span>
      <input
        type="range"
        min={minMinutes}
        max={maxMinutes}
        step={15}
        value={valueMinutes}
        onChange={(e) => onChange(minutesToTime(Number(e.target.value)))}
        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      <span className="text-sm text-gray-500 w-12 text-right">{max}</span>
      <span className="text-sm font-medium text-gray-700 w-14 text-center bg-amber-50 rounded px-2 py-1">
        {value}
      </span>
    </div>
  );
}
