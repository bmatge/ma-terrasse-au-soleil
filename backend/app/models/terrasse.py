from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Boolean, Float, Integer, String, DateTime, Text
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

    # Google Places enrichment (legacy, kept for existing data)
    price_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    google_place_id: Mapped[str | None] = mapped_column(String(300), nullable=True)
    place_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_rating_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    google_maps_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    nom_commercial: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # OSM enrichment
    osm_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    opening_hours: Mapped[str | None] = mapped_column(Text, nullable=True)
    cuisine: Mapped[str | None] = mapped_column(Text, nullable=True)
    outdoor_seating: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # SIRENE enrichment
    enseigne_sirene: Mapped[str | None] = mapped_column(String(300), nullable=True)
    etat_administratif: Mapped[str | None] = mapped_column(String(2), nullable=True)
    code_naf: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Enrichment tracking
    enrichment_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    enrichment_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    horizon_profile: Mapped["HorizonProfile | None"] = relationship(
        back_populates="terrasse", uselist=False
    )
