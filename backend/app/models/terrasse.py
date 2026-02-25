from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Float, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Terrasse(Base):
    __tablename__ = "terrasses"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String, nullable=False)
    adresse: Mapped[str | None] = mapped_column(String, nullable=True)
    arrondissement: Mapped[str | None] = mapped_column(String(5), nullable=True)
    geometry = mapped_column(Geometry("POINT", srid=4326), nullable=False, index=True)
    typologie: Mapped[str | None] = mapped_column(String(50), nullable=True)
    siret: Mapped[str | None] = mapped_column(String(20), nullable=True)
    longueur: Mapped[float | None] = mapped_column(Float, nullable=True)
    largeur: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="paris_opendata")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    horizon_profile: Mapped["HorizonProfile | None"] = relationship(
        back_populates="terrasse", uselist=False
    )
