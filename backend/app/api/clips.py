import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.clip import Clip
from app.models.video import Video
from app.schemas.clip import ClipResponse


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/clips",
    tags=["Clips"],
)


# =================================
# Get all clips for a video
# =================================

@router.get(
    "/video/{video_id}",
    response_model=list[ClipResponse],
)
async def get_video_clips(
    video_id: int,
    db: AsyncSession = Depends(get_db),
):
    # ---------------------------------
    # Check video exists
    # ---------------------------------

    result = await db.execute(
        select(Video).where(
            Video.id == video_id
        )
    )

    video = result.scalar_one_or_none()

    if video is None:
        raise HTTPException(
            status_code=404,
            detail="Video not found",
        )

    # ---------------------------------
    # Get clips
    # ---------------------------------

    result = await db.execute(
        select(Clip)
        .where(
            Clip.video_id == video_id
        )
        .order_by(
            Clip.score.desc()
        )
    )

    clips = result.scalars().all()

    # ---------------------------------
    # Build response
    # ---------------------------------

    return [
        ClipResponse(
            id=clip.id,
            video_id=clip.video_id,
            candidate_id=clip.candidate_id,
            start_time=clip.start_time,
            end_time=clip.end_time,
            duration=clip.duration,
            score=clip.score,
            status=clip.status,
            video_url=(
                f"/clips/{clip.id}/video"
            ),
        )
        for clip in clips
    ]


# =================================
# Get actual video
# =================================

@router.get(
    "/{clip_id}/video",
)
async def get_clip_video(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
):
    # ---------------------------------
    # Find clip
    # ---------------------------------

    result = await db.execute(
        select(Clip).where(
            Clip.id == clip_id
        )
    )

    clip = result.scalar_one_or_none()

    if clip is None:
        raise HTTPException(
            status_code=404,
            detail="Clip not found",
        )

    # ---------------------------------
    # Check status
    # ---------------------------------

    if clip.status != "generated":
        raise HTTPException(
            status_code=404,
            detail="Clip is not ready",
        )

    # ---------------------------------
    # Check file
    # ---------------------------------

    file_path = Path(
        clip.file_path
    )

    if not file_path.exists():
        logger.error(
            "Clip file not found: "
            "clip_id=%s path=%s",
            clip_id,
            file_path,
        )

        raise HTTPException(
            status_code=404,
            detail="Clip file not found",
        )

    # ---------------------------------
    # Return video
    # ---------------------------------

    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=file_path.name,
    )
    
# =================================
# Get single clip
# =================================

@router.get(
    "/{clip_id}",
    response_model=ClipResponse,
)
async def get_clip(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
):
    # ---------------------------------
    # Find clip
    # ---------------------------------

    result = await db.execute(
        select(Clip).where(
            Clip.id == clip_id
        )
    )

    clip = result.scalar_one_or_none()

    # ---------------------------------
    # Clip not found
    # ---------------------------------

    if clip is None:
        raise HTTPException(
            status_code=404,
            detail="Clip not found",
        )

    # ---------------------------------
    # Return clip
    # ---------------------------------

    return ClipResponse(
        id=clip.id,
        video_id=clip.video_id,
        candidate_id=clip.candidate_id,
        start_time=clip.start_time,
        end_time=clip.end_time,
        duration=clip.duration,
        score=clip.score,
        status=clip.status,
        video_url=(
            f"/clips/{clip.id}/video"
        ),
    )