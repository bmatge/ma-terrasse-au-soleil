export function currentHourKey(): string {
  const h = Math.max(9, Math.min(19, new Date().getHours()));
  return `${h.toString().padStart(2, "0")}:00`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function maxDateISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function isSunnyStatus(status: string): boolean {
  return status === "soleil" || status === "mitige";
}

export const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Turn a place name into a URL-friendly slug: "Métro Bastille, Paris" → "metro-bastille-paris" */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Reverse a slug to a geocodable query: "metro-bastille-paris" → "metro bastille paris" */
export function unslugify(slug: string): string {
  return slug.replace(/-/g, " ");
}

export function parseCurrentUrl() {
  const path = window.location.pathname;
  const p = new URLSearchParams(window.location.search);
  return { path, p };
}

export function destinationPoint(lat: number, lon: number, bearing: number, distanceM: number): [number, number] {
  const R = 6371000;
  const d = distanceM / R;
  const brng = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}
