from enum import Enum

from pydantic import BaseModel, Field, HttpUrl

class VideoCreate(BaseModel):
    url: HttpUrl = Field(
        ...,
        description="YouTube video URL",
        examples=[
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ],
    )


class VideoStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoResponse(BaseModel):
    id: int = Field(
        ...,
        description="Unique identifier of the video",
        examples=[1],
    )

    youtube_url: HttpUrl = Field(
        ...,
        description="Original YouTube video URL",
        examples=[
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ],
    )

    youtube_id: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="YouTube video ID",
        examples=["dQw4w9WgXcQ"],
    )

    status: VideoStatus = Field(
        ...,
        description="Current processing status of the video",
        examples=["pending"],
    )

    model_config = {
        "from_attributes": True
    }
    
class JobResponse(BaseModel):
    id: int
    status: str
    progress: int
    error: str | None = None

    model_config = {
        "from_attributes": True,
    }


class VideoDetailResponse(VideoResponse):
    job: JobResponse | None = None

