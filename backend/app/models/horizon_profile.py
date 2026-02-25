from datetime import datetime

from sqlalchemy import ARRAY, DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class HorizonProfile(Base):
    __tablename__ = "horizon_profiles"

    terrasse_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("terrasses.id", ondelete="CASCADE"), primary_key=True
    )
    profile: Mapped[list[float]] = mapped_column(ARRAY(Float, dimensions=1), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    terrasse: Mapped["Terrasse"] = relationship(back_populates="horizon_profile")
