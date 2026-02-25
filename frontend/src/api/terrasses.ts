import { apiFetch } from "./client";
import type {
  GeocodeResult,
  NearbyResponse,
  TerrasseSearchResult,
  TimelineResponse,
} from "./types";

export function searchTerrasses(q: string): Promise<TerrasseSearchResult[]> {
  return apiFetch("/terrasses/search", { q });
}

export function getTimeline(
  terrasseId: number,
  date?: string,
): Promise<TimelineResponse> {
  return apiFetch(`/terrasses/${terrasseId}/timeline`, date ? { date } : {});
}

export function getNearby(
  lat: number,
  lon: number,
  datetime?: string,
  radius?: number,
): Promise<NearbyResponse> {
  const params: Record<string, string | number> = { lat, lon };
  if (datetime) params.datetime = datetime;
  if (radius) params.radius = radius;
  return apiFetch("/terrasses/nearby", params);
}

export function geocode(q: string): Promise<GeocodeResult[]> {
  return apiFetch("/geocode", { q });
}
