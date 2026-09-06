from datetime import datetime

from pydantic import BaseModel, Field


class PublishRequest(BaseModel):
    clip_ids: list[int] = Field(
        ...,
        min_length=1,
        description="Clip IDs to publish",
    )
    platforms: list[str] = Field(
        ...,
        min_length=1,
        description="Platforms: 'instagram' and/or 'youtube'",
    )
    title: str = Field(
        default="",
        max_length=100,
        description="Title used for YouTube uploads",
    )
    description: str = Field(
        default="",
        max_length=2200,
        description="Description used as caption / video description",
    )
    caption: str = Field(
        default="",
        max_length=2200,
        description="Instagram caption (overrides description when set)",
    )


class PublishingJobResponse(BaseModel):
    id: int
    clip_id: int
    platform: str
    status: str
    progress: int
    external_id: str | None = None
    external_url: str | None = None
    error: str | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class PublishQueuedResponse(BaseModel):
    status: str
    jobs: list[PublishingJobResponse]