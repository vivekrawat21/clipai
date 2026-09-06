"""
Celery publishing tasks.

These tasks are thin wrappers around the publishing service layer:
    app/services/publishing/*

Idempotency: the publisher refuses to re-publish a job that is already
marked "published", so retried tasks cannot accidentally double-publish.
"""
import logging

from app.services.publishing.publisher import (
    PublishError,
    PublishIdempotencyError,
    publish,
)
from app.worker.celery_app import celery_app


logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=4, acks_late=True)
def publish_to_instagram(
    self,
    job_id: int,
):
    """
    Publish a clip to Instagram (as a Reel) via a PublishingJob.
    """
    try:
        return publish(job_id)

    except PublishIdempotencyError:
        # Already published — safe no-op.
        logger.info(
            "Instagram publish skipped (idempotent): job_id=%s",
            job_id,
        )
        return {"job_id": job_id, "status": "already_published"}

    except PublishError as exc:
        logger.error(
            "Instagram publish failed: job_id=%s error=%s",
            job_id,
            exc,
        )

        retries = getattr(self, "request", None)
        if retries and retries.retries < self.max_retries:
            raise self.retry(
                exc=exc,
                countdown=60 * (retries.retries + 1),
            )

        raise


@celery_app.task(bind=True, max_retries=4, acks_late=True)
def publish_to_youtube(
    self,
    job_id: int,
):
    """
    Publish a clip to YouTube (as a Short) via a PublishingJob.
    """
    try:
        return publish(job_id)

    except PublishIdempotencyError:
        logger.info(
            "YouTube publish skipped (idempotent): job_id=%s",
            job_id,
        )
        return {"job_id": job_id, "status": "already_published"}

    except PublishError as exc:
        logger.error(
            "YouTube publish failed: job_id=%s error=%s",
            job_id,
            exc,
        )

        retries = getattr(self, "request", None)
        if retries and retries.retries < self.max_retries:
            raise self.retry(
                exc=exc,
                countdown=60 * (retries.retries + 1),
            )

        raise