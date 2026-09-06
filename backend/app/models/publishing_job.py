from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PublishingJob(Base):
    __tablename__ = "publishing_jobs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    clip_id: Mapped[int] = mapped_column(
        ForeignKey("clips.id"),
        nullable=False,
        index=True,
    )

    platform: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    # queued | uploading | publishing | published | failed
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="queued",
        index=True,
    )

    progress: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    external_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    external_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Optional metadata passed at publish time (title/description/caption)
    payload: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )