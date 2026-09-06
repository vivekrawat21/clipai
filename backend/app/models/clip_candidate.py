from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.db.base import Base


class ClipCandidate(Base):
    __tablename__ = "clip_candidates"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    video_id: Mapped[int] = mapped_column(
        ForeignKey("videos.id"),
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

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )