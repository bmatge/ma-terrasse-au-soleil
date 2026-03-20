/** Normalize raw Google Places types into 3 display categories */
export type PlaceCategory = "restaurant" | "cafe" | "autre";

const TYPE_MAP: Record<string, PlaceCategory> = {
  restaurant: "restaurant",
  meal_takeaway: "restaurant",
  cafe: "cafe",
  bar: "cafe",
  bakery: "autre",
  night_club: "autre",
  ice_cream_shop: "autre",
};

export function normalizePlaceType(raw: string | null | undefined): PlaceCategory | null {
  if (!raw) return null;
  return TYPE_MAP[raw] ?? "autre";
}
