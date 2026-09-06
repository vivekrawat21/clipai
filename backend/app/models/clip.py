from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Clip(Base):
    __tablename__ = "clips"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    video_id: Mapped[int] = mapped_column(
        ForeignKey("videos.id"),
        nullable=False,
        index=True,
    )

    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("clip_candidates.id"),
        nullable=False,
        index=True,
    )

    start_time: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    end_time: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    duration: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="generated",
    )