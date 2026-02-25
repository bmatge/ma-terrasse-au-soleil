from pydantic import BaseModel


class MeteoInfo(BaseModel):
    cloud_cover: int
    status: str
    precipitation_probability: int


class NearbyTerrasse(BaseModel):
    id: int
    nom: str
    adresse: str | None
    lat: float
    lon: float
    distance_m: int
    status: str
    soleil_jusqua: str | None


class NearbyResponse(BaseModel):
    meteo: MeteoInfo
    terrasses: list[NearbyTerrasse]
