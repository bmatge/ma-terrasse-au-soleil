from pydantic import BaseModel


class TerrasseSearchResult(BaseModel):
    id: int
    nom: str
    nom_commercial: str | None = None
    adresse: str | None
    arrondissement: str | None
    lat: float
    lon: float
    price_level: int | None = None
    place_type: str | None = None
    rating: float | None = None
    user_rating_count: int | None = None
    phone: str | None = None
    website: str | None = None
    google_maps_uri: str | None = None
    surface_m2: float | None = None
    terrasse_count: int = 1
