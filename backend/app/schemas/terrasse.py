from pydantic import BaseModel


class TerrasseSearchResult(BaseModel):
    id: int
    nom: str
    adresse: str | None
    arrondissement: str | None
    lat: float
    lon: float
