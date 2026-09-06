import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.processing_job import ProcessingJob
from app.models.video import Video
from app.schemas.video import VideoCreate, VideoDetailResponse, VideoResponse
from app.services.youtube import extract_youtube_id
from app.worker.tasks import process_video


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api/videos",
    tags=["Videos"],
)


@router.post(
    "",
    response_model=VideoResponse,
)
async def create_video(
    video_data: VideoCreate,
    db: AsyncSession = Depends(get_db),
):
    youtube_url = str(video_data.url)

    # 1. Extract YouTube ID
    try:
        youtube_id = extract_youtube_id(youtube_url)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL",
        )
        

    logger.info(
        "Creating video: youtube_id=%s",
        youtube_id,
    )

    result = await db.execute(
        select(Video).where(
            Video.youtube_id == youtube_id
        )
    )

    video = result.scalar_one_or_none()

    if video:
        logger.info(
            "Video already exists: video_id=%s youtube_id=%s",
            video.id,
            youtube_id,
        )
        if video.status in {"pending", "processing", "completed"}:
            return video

    # 3. Create Video
    video = Video(
        youtube_url=youtube_url,
        youtube_id=youtube_id,
        status="pending",
    )

    db.add(video)

    # 4. Flush so video.id is generated
    await db.flush()

    logger.info(
        "Video created: video_id=%s",
        video.id,
    )

    # 5. Create ProcessingJob
    job = ProcessingJob(
        video_id=video.id,
        job_type="video_processing",
        status="queued",
        progress=0,
    )

    db.add(job)

    # 6. Commit both Video + Job
    await db.commit()

    await db.refresh(video)
    await db.refresh(job)

    logger.info(
        "Processing job created: job_id=%s video_id=%s",
        job.id,
        video.id,
    )

    # 7. Queue Celery task
    process_video.delay(
        video.id,
        job.id,
    )

    logger.info(
        "Processing task queued: video_id=%s job_id=%s",
        video.id,
        job.id,
    )

    return video


@router.get(
    "",
    response_model=list[VideoResponse],
)
async def list_videos(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Video)
    )
    videos = result.scalars().all()
    return videos

@router.get(
    "/{video_id}",
    response_model=VideoDetailResponse,
)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
):
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

    result = await db.execute(
        select(ProcessingJob)
        .where(
            ProcessingJob.video_id == video_id
        )
        .order_by(
            ProcessingJob.created_at.desc()
        )
    )

    job = result.scalars().first()

    return {
        "id": video.id,
        "youtube_url": video.youtube_url,
        "youtube_id": video.youtube_id,
        "status": video.status,
        "job": job,
    }