from pydantic import BaseModel

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