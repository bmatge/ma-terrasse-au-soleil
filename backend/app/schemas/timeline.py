from pydantic import BaseModel


class TimelineSlot(BaseModel):
    time: str
    sun_altitude: float
    urban_sunny: bool
    cloud_cover: int
    status: str


class BestWindow(BaseModel):
    debut: str
    fin: str
    duree_minutes: int


class TimelineResponse(BaseModel):
    terrasse: "TerrasseSearchResult"
    date: str
    slots: list[TimelineSlot]
    meilleur_creneau: BestWindow | None
    meteo_resume: str


from app.schemas.terrasse import TerrasseSearchResult  # noqa: E402

TimelineResponse.model_rebuild()
