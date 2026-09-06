
from sqlalchemy.orm import Mapped
from app.db.base import Base
from sqlalchemy import ForeignKey, Integer, Float, Text
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

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

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(384),
        nullable=True,
    )