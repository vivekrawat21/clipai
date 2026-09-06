import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.clip import Clip
from app.models.publishing_job import PublishingJob
from app.models.social_account import SocialAccount
from app.schemas.publishing import (
    PublishQueuedResponse,
    PublishRequest,
    PublishingJobResponse,
)
from app.services.publishing.publisher import SUPPORTED_PLATFORMS
from app.worker.publishing_tasks import (
    publish_to_instagram,
    publish_to_youtube,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api/publishing",
    tags=["Publishing"],
)


def _job_response(job: PublishingJob) -> PublishingJobResponse:
    return PublishingJobResponse(
        id=job.id,
        clip_id=job.clip_id,
        platform=job.platform,
        status=job.status,
        progress=job.progress,
        external_id=job.external_id,
        external_url=job.external_url,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


# =================================
# One-click publish (Phase 11)
# =================================

@router.post(
    "",
    response_model=PublishQueuedResponse,
)
async def create_publishing_jobs(
    request: PublishRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Validate, create PublishingJob records, and queue Celery tasks.

    Returns immediately — uploads happen asynchronously.
    """
    platforms = [
        p.lower()
        for p in request.platforms
    ]

    for platform in platforms:
        if platform not in SUPPORTED_PLATFORMS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform: {platform}",
            )

    if len(set(platforms)) != len(platforms):
        raise HTTPException(
            status_code=400,
            detail="Duplicate platforms in request",
        )

    # ---------------------------------
    # Load + validate clips
    # ---------------------------------

    result = await db.execute(
        select(Clip).where(
            Clip.id.in_(request.clip_ids)
        )
    )
    clips_raw = result.scalars().all()
    clips_by_id = {
        clip.id: clip
        for clip in clips_raw
    }

    if len(clips_by_id) != len(set(request.clip_ids)):
        missing = set(request.clip_ids) - set(clips_by_id)
        raise HTTPException(
            status_code=404,
            detail=f"Clips not found: {sorted(missing)}",
        )

    for clip_id in request.clip_ids:
        clip = clips_by_id[clip_id]
        if clip.status == "rendering":
            raise HTTPException(
                status_code=409,
                detail=f"Clip {clip_id} is still rendering",
            )
        if clip.status == "failed" or not clip.rendered_file_path:
            raise HTTPException(
                status_code=409,
                detail=f"Clip {clip_id} is not rendered",
            )

    # ---------------------------------
    # Verify connected social accounts
    # ---------------------------------

    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.is_active.is_(True)
        )
    )
    connected_platforms = {
        account.platform
        for account in result.scalars().all()
    }

    for platform in platforms:
        if platform not in connected_platforms:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"No connected {platform} account. "
                    f"Connect it first via /api/social/{platform}/auth-url"
                ),
            )

    # ---------------------------------
    # Create jobs
    # ---------------------------------

    payload = json.dumps(
        {
            "title": request.title,
            "description": request.description,
            "caption": request.caption,
        }
    )

    jobs = []

    for clip_id in request.clip_ids:
        for platform in platforms:
            job = PublishingJob(
                clip_id=clip_id,
                platform=platform,
                status="queued",
                progress=0,
                payload=payload,
            )
            db.add(job)
            await db.flush()
            jobs.append(job)

    await db.commit()

    # ---------------------------------
    # Queue Celery tasks
    # ---------------------------------

    for job in jobs:
        if job.platform == "instagram":
            publish_to_instagram.delay(job.id)
        else:
            publish_to_youtube.delay(job.id)

    logger.info(
        "Publishing jobs queued: clips=%s platforms=%s jobs=%s",
        request.clip_ids,
        platforms,
        [job.id for job in jobs],
    )

    return PublishQueuedResponse(
        status="queued",
        jobs=[
            _job_response(job)
            for job in jobs
        ],
    )


# =================================
# Publishing status (Phase 13)
# =================================

@router.get(
    "",
    response_model=list[PublishingJobResponse],
)
async def list_publishing_jobs(
    clip_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(PublishingJob).order_by(
        PublishingJob.created_at.desc()
    )

    if clip_id is not None:
        query = query.where(
            PublishingJob.clip_id == clip_id
        )

    result = await db.execute(query)
    jobs = result.scalars().all()

    return [
        _job_response(job)
        for job in jobs
    ]


@router.get(
    "/{job_id}",
    response_model=PublishingJobResponse,
)
async def get_publishing_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PublishingJob).where(
            PublishingJob.id == job_id
        )
    )

    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Publishing job not found",
        )

    return _job_response(job)