export interface TerrasseSearchResult {
  id: number;
  nom: string;
  adresse: string | null;
  arrondissement: string | null;
  lat: number;
  lon: number;
}

export interface TimelineSlot {
  time: string;
  sun_altitude: number;
  urban_sunny: boolean;
  cloud_cover: number;
  status: "soleil" | "mitige" | "couvert" | "ombre_batiment" | "nuit";
}

export interface BestWindow {
  debut: string;
  fin: string;
  duree_minutes: number;
}

export interface TimelineResponse {
  terrasse: TerrasseSearchResult;
  date: string;
  slots: TimelineSlot[];
  meilleur_creneau: BestWindow | null;
  meteo_resume: string;
}

export interface MeteoInfo {
  cloud_cover: number;
  status: string;
  precipitation_probability: number;
}

export interface NearbyTerrasse {
  id: number;
  nom: string;
  adresse: string | null;
  lat: number;
  lon: number;
  distance_m: number;
  status: "soleil" | "mitige" | "couvert" | "ombre" | "nuit";
  soleil_jusqua: string | null;
}

export interface NearbyResponse {
  meteo: MeteoInfo;
  terrasses: NearbyTerrasse[];
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
  postcode: string;
}
