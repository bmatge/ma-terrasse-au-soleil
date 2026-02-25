from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class MeteoCache(Base):
    __tablename__ = "meteo_cache"
    __table_args__ = (
        UniqueConstraint("lat_grid", "lon_grid", "date", name="uq_meteo_cache_location_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lat_grid: Mapped[float] = mapped_column(Float, nullable=False)
    lon_grid: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    hourly_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
