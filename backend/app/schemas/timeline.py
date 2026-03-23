from pydantic import BaseModel


class TimelineSlot(BaseModel):
    time: str
    sun_altitude: float
    sun_azimuth: float
    urban_sunny: bool
    cloud_cover: int
    uv_index: float
    status: str


class BestWindow(BaseModel):
    debut: str
    fin: str
    duree_minutes: int


class SiblingTerrasse(BaseModel):
    id: int
    adresse: str | None = None
    typologie: str | None = None
    surface_m2: float | None = None
    lat: float
    lon: float


class TimelineResponse(BaseModel):
    terrasse: "TerrasseSearchResult"
    date: str
    slots: list[TimelineSlot]
    meilleur_creneau: BestWindow | None
    meteo_resume: str
    siblings: list[SiblingTerrasse] | None = None
    surface_totale_m2: float | None = None


from app.schemas.terrasse import TerrasseSearchResult  # noqa: E402

TimelineResponse.model_rebuild()
