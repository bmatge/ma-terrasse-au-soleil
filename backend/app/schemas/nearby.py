from pydantic import BaseModel


class MeteoInfo(BaseModel):
    cloud_cover: int
    status: str
    precipitation_probability: int
    uv_index: float


class NearbyTerrasse(BaseModel):
    id: int
    nom: str
    adresse: str | None
    lat: float
    lon: float
    distance_m: int
    status: str
    soleil_jusqua: str | None
    price_level: int | None = None
    place_type: str | None = None
    rating: float | None = None
    user_rating_count: int | None = None


class NearbyResponse(BaseModel):
    meteo: MeteoInfo
    terrasses: list[NearbyTerrasse]
