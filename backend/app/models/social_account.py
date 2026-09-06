from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    # Placeholder for future multi-user auth; current app scope is a
    # single workspace, but the column is retained for forward-compat.
    user_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="default",
        index=True,
    )

    platform: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    external_account_id: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
    )

    # Encrypted at rest via services.secrets
    access_token_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    refresh_token_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Extensible JSON/dict payload (display name, handle, avatar, etc.)
    metadata_: Mapped[str | None] = mapped_column(
        "metadata",
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "platform",
            "external_account_id",
            name="uq_social_accounts_user_platform_external",
        ),
    )