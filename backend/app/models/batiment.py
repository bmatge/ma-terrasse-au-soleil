from geoalchemy2 import Geometry
from sqlalchemy import Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Batiment(Base):
    __tablename__ = "batiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    geometry = mapped_column(Geometry("POLYGON", srid=4326), nullable=False, index=True)
    hauteur: Mapped[float] = mapped_column(Float, nullable=False)
    altitude_sol: Mapped[float | None] = mapped_column(Float, nullable=True)
