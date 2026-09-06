from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TranscriptWord(Base):
    __tablename__ = "transcript_words"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    segment_id: Mapped[int] = mapped_column(
        ForeignKey("transcript_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    video_id: Mapped[int] = mapped_column(
        ForeignKey("videos.id"),
        nullable=False,
        index=True,
    )

    word: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    start_time: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    end_time: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
