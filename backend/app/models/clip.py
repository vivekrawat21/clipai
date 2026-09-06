from sqlalchemy import Float, ForeignKey, Integer, String, Text
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

    # Raw clip produced by the clip generator
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    # Final rendered clip (subtitles + effects + 9:16)
    rendered_file_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Per-clip subtitle style overrides (JSON dict, merged over the
    # default SubtitleStyle). Kept as Text so the DB schema stays
    # portable across engines.
    subtitle_style: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    render_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    duration: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # generated | rendering | rendered | failed
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="generated",
    )