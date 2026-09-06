"""
Generic publisher.

Loads the correct platform publisher based on the job's platform and
provides the shared flow: decrypt tokens → refresh if expired → call
the platform-specific publish function → update the job.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from app.db.sync_database import SessionLocal
from app.models.clip import Clip
from app.models.publishing_job import PublishingJob
from app.models.social_account import SocialAccount
from app.services.media_url import get_public_clip_url
from app.services.publishing.instagram import (
    InstagramPublishError,
    publish_to_instagram,
)
from app.services.publishing.youtube import (
    YouTubePublishError,
    publish_to_youtube,
)
from app.services.secrets import decrypt_secret
from app.services.social.oauth import (
    OAuthExchangeError,
    refresh_youtube_access_token,
)


logger = logging.getLogger(__name__)


class PublishError(Exception):
    pass


class PublishConfigError(Exception):
    pass


class PublishIdempotencyError(Exception):
    pass


SUPPORTED_PLATFORMS = {"instagram", "youtube"}


def load_account(
    db,
    platform: str,
) -> SocialAccount:
    account = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.platform == platform,
            SocialAccount.is_active.is_(True),
        )
        .order_by(SocialAccount.updated_at.desc())
        .first()
    )

    if account is None:
        raise PublishConfigError(
            f"No connected {platform} account found"
        )

    return account


def _decrypt_account_tokens(
    account: SocialAccount,
) -> tuple[str, str]:
    access_token = decrypt_secret(account.access_token_encrypted)
    refresh_token = decrypt_secret(account.refresh_token_encrypted)

    if not access_token:
        raise PublishConfigError(
            f"Stored {account.platform} access token is empty"
        )

    return access_token, refresh_token


def _ensure_valid_youtube_token(
    account: SocialAccount,
    access_token: str,
    refresh_token: str,
) -> tuple[str, bool]:
    """
    Refreshes a YouTube access token when it has expired.

    Returns (valid_access_token, refreshed).
    """
    now = datetime.now(timezone.utc)

    expires = account.token_expires_at
    if expires and expires.replace(tzinfo=timezone.utc) > now:
        return access_token, False

    if not refresh_token:
        raise PublishConfigError(
            "YouTube refresh token is missing; re-connect the account"
        )

    try:
        refreshed = refresh_youtube_access_token(refresh_token)
    except OAuthExchangeError as exc:
        raise PublishConfigError(
            f"Failed to refresh YouTube token: {exc}"
        )

    new_token = refreshed.get("access_token", "")
    if not new_token:
        raise PublishConfigError(
            "YouTube refresh did not return a token"
        )

    from app.services.secrets import encrypt_secret

    account.access_token_encrypted = encrypt_secret(new_token)

    if refreshed.get("expires_in"):
        account.token_expires_at = datetime.now(
            timezone.utc
        ) + timedelta(seconds=int(refreshed["expires_in"]))

    account.updated_at = datetime.utcnow()

    return new_token, True


def _load_payload(
    job: PublishingJob,
) -> dict:
    if not job.payload:
        return {}
    try:
        return json.loads(job.payload)
    except (TypeError, ValueError):
        return {}


def update_job(
    db,
    job: PublishingJob,
    *,
    status: str | None = None,
    progress: int | None = None,
    external_id: str | None = None,
    external_url: str | None = None,
    error: str | None = None,
    started_at: datetime | None = None,
):
    if status is not None:
        job.status = status

    if progress is not None:
        job.progress = progress

    if external_id is not None:
        job.external_id = external_id

    if external_url is not None:
        job.external_url = external_url

    if error is not None:
        job.error = error

    if started_at is not None:
        job.started_at = started_at

    if status == "published":
        job.completed_at = datetime.utcnow()

    db.commit()


def publish(job_id: int) -> dict:
    """
    Run a single publishing job to completion.

    Raises:
        PublishIdempotencyError — already published/completed
        PublishError / PublishConfigError — platform failures
    """
    db = SessionLocal()

    try:
        job = db.get(PublishingJob, job_id)

        if job is None:
            raise PublishError(
                f"Publishing job not found: job_id={job_id}"
            )

        # Idempotency guard: never re-publish a completed job.
        if job.status == "published":
            logger.info(
                "Job already published, skipping: job_id=%s",
                job_id,
            )
            raise PublishIdempotencyError(
                f"Job already published: job_id={job_id}"
            )

        clip = db.get(Clip, job.clip_id)

        if clip is None:
            raise PublishError(
                f"Clip not found: clip_id={job.clip_id}"
            )

        # Clips must be rendered before publishing.
        if not clip.rendered_file_path:
            raise PublishError(
                f"Clip is not rendered: clip_id={job.clip_id}"
            )

        from pathlib import Path

        rendered = Path(clip.rendered_file_path)
        if not rendered.exists():
            raise PublishError(
                f"Rendered clip file missing: {clip.rendered_file_path}"
            )

        account = load_account(db, job.platform)

        access_token, refresh_token = _decrypt_account_tokens(account)

        update_job(
            db,
            job,
            status="uploading",
            progress=5,
            started_at=datetime.utcnow(),
            error=None,
        )

        payload = _load_payload(job)

        result = None

        if job.platform == "instagram":
            result = _publish_instagram(
                db,
                account,
                access_token,
                clip,
                job,
                payload,
            )
        elif job.platform == "youtube":
            result = _publish_youtube(
                db,
                account,
                access_token,
                refresh_token,
                clip,
                job,
                payload,
            )
        else:
            raise PublishError(
                f"Unsupported platform: {job.platform}"
            )

        update_job(
            db,
            job,
            status="published",
            progress=100,
            external_id=result.get("external_id"),
            external_url=result.get("external_url"),
            error=None,
        )

        logger.info(
            "Publishing completed: job_id=%s platform=%s external_id=%s",
            job_id,
            job.platform,
            result.get("external_id"),
        )

        return {
            "job_id": job_id,
            "status": "published",
            "external_id": result.get("external_id"),
            "external_url": result.get("external_url"),
        }

    except (PublishIdempotencyError, PublishError) as exc:
        # idempotency skip is not a failure
        db.rollback()
        logger.info(
            "Publish not executed: job_id=%s reason=%s",
            job_id,
            exc,
        )
        raise

    except PublishConfigError as exc:
        db.rollback()
        _mark_failed(db, job_id, str(exc))
        raise

    except Exception as exc:
        db.rollback()
        logger.exception(
            "Unexpected publish failure: job_id=%s",
            job_id,
        )
        _mark_failed(db, job_id, str(exc))
        raise PublishError(str(exc))

    finally:
        db.close()


def _mark_failed(
    db,
    job_id: int,
    error: str,
):
    try:
        job = db.get(PublishingJob, job_id)
        if job:
            job.status = "failed"
            job.error = error
            job.completed_at = datetime.utcnow()
            db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Failed to mark job failed: job_id=%s",
            job_id,
        )


def _publish_instagram(
    db,
    account: SocialAccount,
    access_token: str,
    clip: Clip,
    job: PublishingJob,
    payload: dict,
) -> dict:
    ig_user_id = account.external_account_id

    if not ig_user_id:
        raise PublishConfigError(
            "Instagram account has no external account id"
        )

    update_job(db, job, progress=40)

    public_url = get_public_clip_url(clip.id)

    caption = payload.get("caption") or payload.get("title") or ""

    try:
        result = publish_to_instagram(
            access_token=access_token,
            ig_user_id=ig_user_id,
            public_video_url=public_url,
            caption=caption,
            duration=clip.duration,
        )
    except InstagramPublishError as exc:
        raise PublishError(str(exc))

    update_job(db, job, progress=90, external_id=result["external_id"])

    return result


def _publish_youtube(
    db,
    account: SocialAccount,
    access_token: str,
    refresh_token: str,
    clip: Clip,
    job: PublishingJob,
    payload: dict,
) -> dict:
    access_token, refreshed = _ensure_valid_youtube_token(
        account,
        access_token,
        refresh_token,
    )

    if refreshed:
        try:
            db.commit()
        except Exception:
            db.rollback()

    update_job(db, job, progress=40)

    title = payload.get("title") or f"Clip #{clip.id}"
    description = payload.get("description") or ""

    # Mark Shorts-friendly titles
    if not title.strip().endswith("#Shorts"):
        title = f"{title} #Shorts"

    try:
        result = publish_to_youtube(
            access_token=access_token,
            video_path=clip.rendered_file_path,
            title=title,
            description=description,
            privacy_status="public",
        )
    except YouTubePublishError as exc:
        raise PublishError(str(exc))

    update_job(db, job, progress=90, external_id=result["external_id"])

    return result