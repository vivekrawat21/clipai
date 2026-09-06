import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.clip import Clip
from app.models.video import Video
from app.schemas.clip import (
    ClipPreviewStatus,
    ClipPublishMetadataResponse,
    ClipResponse,
    SubtitleStyleUpdate,
)
from app.services.clip_metadata import (
    build_metadata,
    join_transcript,
)
from app.services.subtitle_style import SubtitleStyle
from app.services.subtitles import fetch_clip_words
from app.worker.tasks import render_clip


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/clips",
    tags=["Clips"],
)


def _clip_response(
    clip: Clip,
) -> ClipResponse:
    style = SubtitleStyle.default()

    if clip.subtitle_style:
        try:
            style = SubtitleStyle.from_dict(
                json.loads(clip.subtitle_style)
            )
        except (ValueError, json.JSONDecodeError):
            logger.warning(
                "Invalid subtitle_style JSON on clip: clip_id=%s",
                clip.id,
            )

    return ClipResponse(
        id=clip.id,
        video_id=clip.video_id,
        candidate_id=clip.candidate_id,
        start_time=clip.start_time,
        end_time=clip.end_time,
        duration=clip.duration,
        score=clip.score,
        status=clip.status,
        video_url=f"/clips/{clip.id}/video",
        preview_url=f"/clips/{clip.id}/preview",
        render_ready=bool(clip.rendered_file_path),
        subtitle_style=style.__dict__.copy(),
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
        _clip_response(clip)
        for clip in clips
    ]


# =================================
# Get actual (raw) video
# =================================

@router.get(
    "/{clip_id}/video",
)
async def get_clip_video(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
):
    clip = await _get_clip_or_404(
        clip_id,
        db,
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
# Get final rendered preview video
# =================================

@router.get(
    "/{clip_id}/preview",
    response_model=ClipPreviewStatus,
    responses={
        200: {
            "content": {
                "video/mp4": {},
            },
            "description": "Final rendered MP4 clip",
        },
        202: {
            "content": {
                "application/json": {
                    "example": {
                        "status": "rendering",
                    }
                },
            },
            "description": "Clip is not yet rendered",
        },
    },
)
async def get_clip_preview(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Return the final rendered clip.

    When the clip has been rendered the MP4 is streamed back directly
    (supports browser range requests). Otherwise a JSON payload with
    the current status is returned so the frontend can poll.
    """
    clip = await _get_clip_or_404(
        clip_id,
        db,
    )

    # ---------------------------------
    # Rendering in progress
    # ---------------------------------

    if clip.status == "rendering":
        return JSONResponse(
            status_code=202,
            content={
                "status": "rendering",
                "message": "Clip is currently rendering",
            },
        )

    # ---------------------------------
    # Not rendered / render failed
    # ---------------------------------

    if clip.status == "failed":
        return JSONResponse(
            status_code=409,
            content={
                "status": "failed",
                "message": "Clip rendering failed",
                "error": clip.render_error,
            },
        )

    # ---------------------------------
    # No final file yet
    # ---------------------------------

    if not clip.rendered_file_path:
        return JSONResponse(
            status_code=202,
            content={
                "status": clip.status,
                "message": "Clip has not been rendered yet",
            },
        )

    # ---------------------------------
    # Serve the final rendered video
    # ---------------------------------

    file_path = Path(
        clip.rendered_file_path
    )

    if not file_path.exists():
        logger.error(
            "Rendered clip file not found: "
            "clip_id=%s path=%s",
            clip_id,
            file_path,
        )

        raise HTTPException(
            status_code=404,
            detail="Rendered clip file not found",
        )

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
    clip = await _get_clip_or_404(
        clip_id,
        db,
    )

    return _clip_response(clip)


# =================================
# Update burned-in subtitle style
# =================================

@router.patch(
    "/{clip_id}/style",
    response_model=ClipResponse,
)
async def update_clip_subtitle_style(
    clip_id: int,
    update: SubtitleStyleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Merge the submitted style overrides into the clip's burned-in
    subtitle style and re-render the clip with the new look.

    Storing the overrides and resetting the clip to ``generated`` makes
    ``render_clip`` idempotently render again (the status guard only
    skips clips that are already ``rendered`` with a file on disk).
    """
    clip = await _get_clip_or_404(
        clip_id,
        db,
    )

    current = clip.subtitle_style
    merged = {}

    if current:
        try:
            merged = json.loads(current)
        except json.JSONDecodeError:
            logger.warning(
                "Overwriting corrupted subtitle_style on clip: clip_id=%s",
                clip.id,
            )

    changes = update.model_dump(exclude_none=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No style fields to update",
        )

    merged.update(changes)
    clip.subtitle_style = json.dumps(merged)

    # Force a re-render with the new style.
    clip.status = "generated"
    clip.render_error = None
    clip.rendered_file_path = None

    await db.commit()
    await db.refresh(clip)

    # Re-queue the render with the new look.
    render_clip.delay(clip.id)

    return _clip_response(clip)


# =================================
# Auto-generated publish metadata
# =================================

@router.get(
    "/{clip_id}/metadata",
    response_model=ClipPublishMetadataResponse,
)
async def get_clip_publish_metadata(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate publish-ready copy for a clip: YouTube title/description,
    Instagram caption + hashtags, and the hook used on the video itself.
    """
    clip = await _get_clip_or_404(
        clip_id,
        db,
    )

    video_result = await db.execute(
        select(Video).where(
            Video.id == clip.video_id
        )
    )
    video = video_result.scalar_one_or_none()

    words_result = await fetch_clip_words(
        db,
        clip,
    )
    transcript = join_transcript(
        [word.word for word in words_result]
    )

    metadata = build_metadata(
        transcript,
        video_title=video.title if video else None,
    )

    return ClipPublishMetadataResponse(
        title=metadata.title,
        description=metadata.description,
        caption=metadata.caption,
        hashtags=metadata.hashtags,
        hook=metadata.hook,
    )


# =================================
# Shared lookup helper
# =================================

async def _get_clip_or_404(
    clip_id: int,
    db: AsyncSession,
) -> Clip:
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

    return clip