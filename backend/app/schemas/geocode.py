from pydantic import BaseModel


class GeocodeResult(BaseModel):
    lat: float
    lon: float
    label: str
    postcode: str
