from pydantic import BaseModel, ConfigDict, Field

from app.services.subtitle_style import SubtitleStyle


class ClipResponse(BaseModel):
    id: int
    video_id: int
    candidate_id: int
    start_time: float
    end_time: float
    duration: float

    score: float
    status: str

    video_url: str
    preview_url: str

    # True when the final rendered file is available for preview
    render_ready: bool = False

    # Flattened subtitle style so the UI can render color/font options
    # without a second round trip.
    subtitle_style: dict = Field(
        default_factory=lambda: SubtitleStyle.default().__dict__.copy()
    )


class SubtitleStyleUpdate(BaseModel):
    """
    Optional per-clip overrides for the burned-in subtitle style.

    Only the keys explicitly sent are changed; everything else falls
    back to the backend defaults. Colors are hex strings like
    ``#FFFFFF``.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    font_size: int | None = Field(
        default=None,
        ge=20,
        le=200,
    )
    primary_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
    )
    highlight_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
    )
    dimmed_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
    )
    outline_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
    )
    outline_width: float | None = Field(
        default=None,
        ge=0.0,
        le=10.0,
    )
    words_per_line: int | None = Field(
        default=None,
        ge=1,
        le=8,
    )


class ClipPreviewStatus(BaseModel):
    status: str
    message: str
    preview_url: str | None = None


class ClipPreviewResponse(BaseModel):
    status: str
    preview_url: str | None = None
    error: str | None = None


class ClipPublishMetadataResponse(BaseModel):
    """
    Auto-generated publish copy for a single clip.

    Great as defaults — the user is free to edit every field before
    hitting publish.
    """

    title: str
    description: str
    caption: str
    hashtags: list[str]
    hook: str