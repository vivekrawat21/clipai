from datetime import datetime

from sqlalchemy import DateTime, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    youtube_url: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
    )

    youtube_id: Mapped[str] = mapped_column(
    String(20),
    nullable=False,
    unique=True,
    index=True,
)

    title: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    duration: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
    )
    
    source_path: Mapped[str | None] = mapped_column(
    Text,
    nullable=True,
)
    audio_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )