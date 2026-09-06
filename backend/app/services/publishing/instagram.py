"""
Instagram publishing service.

Implements the official Instagram Graph API container model
(2026 requirements — Instagram Login for Business):

    1. POST /{ig-user-id}/media          (media_type=REELS, public video_url)
    2. Poll  /{container-id}?fields=status_code  until FINISHED
    3. POST /{ig-user-id}/media_publish  (creation_id)

Requirements enforced upstream: the clip must be a professional-account
compatible vertical 9:16 MP4 between 5-90 seconds, reachable at a public
HTTPS URL.

No browser automation or password-based login is used.
"""
import logging
import time

import requests

from app.core.config import settings


logger = logging.getLogger(__name__)


INSTAGRAM_GRAPH_HOST = "https://graph.instagram.com"
API_VERSION = "v25.0"

CONTAINER_POLL_INTERVAL = 8
CONTAINER_POLL_TIMEOUT = 300

MIN_DURATION = 5.0
MAX_DURATION = 90.0


class InstagramPublishError(Exception):
    """Raised for unresolvable Instagram publishing failures."""


def validate_clip_duration(duration: float) -> None:
    if duration < MIN_DURATION or duration > MAX_DURATION:
        raise InstagramPublishError(
            f"Instagram Reels requires {MIN_DURATION}-{MAX_DURATION}s "
            f"videos; got {duration:.1f}s"
        )


def _post_json(
    url: str,
    params: dict,
) -> dict:
    try:
        response = requests.post(url, params=params, timeout=60)
    except requests.RequestException as exc:
        raise InstagramPublishError(
            f"Instagram API request failed: {exc}"
        )

    data = response.json()

    if response.status_code >= 400:
        logger.error(
            "Instagram API error: status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise InstagramPublishError(
            f"Instagram API error {response.status_code}: {response.text}"
        )

    return data


def _get_json(
    url: str,
    params: dict,
) -> dict:
    try:
        response = requests.get(url, params=params, timeout=30)
    except requests.RequestException as exc:
        raise InstagramPublishError(
            f"Instagram API request failed: {exc}"
        )

    data = response.json()

    if response.status_code >= 400:
        logger.error(
            "Instagram API error: status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise InstagramPublishError(
            f"Instagram API error {response.status_code}: {response.text}"
        )

    return data


def create_reel_container(
    *,
    access_token: str,
    ig_user_id: str,
    public_video_url: str,
    caption: str,
) -> str:
    """Create a REELS media container and return its container id."""
    params = {
        "media_type": "REELS",
        "video_url": public_video_url,
        "caption": caption,
        "share_to_feed": "true",
    }

    # Try alternate host first; some apps use graph.facebook.com.
    url = (
        f"{INSTAGRAM_GRAPH_HOST}/{API_VERSION}/{ig_user_id}/media"
    )

    data = _post_json(url, {**params, "access_token": access_token})

    container_id = data.get("id")

    if not container_id:
        raise InstagramPublishError(
            f"Instagram did not return a container id: {data}"
        )

    logger.info(
        "Instagram container created: container_id=%s",
        container_id,
    )

    return container_id


def wait_for_container_ready(
    *,
    access_token: str,
    container_id: str,
) -> None:
    """
    Poll the container status until FINISHED.

    Raises InstagramPublishError on ERROR status or timeout.
    """
    url = (
        f"{INSTAGRAM_GRAPH_HOST}/{API_VERSION}/{container_id}"
    )

    elapsed = 0.0

    while elapsed < CONTAINER_POLL_TIMEOUT:
        data = _get_json(
            url,
            {
                "fields": "status_code",
                "access_token": access_token,
            },
        )

        status_code = (data.get("status_code") or "").upper()

        if status_code == "FINISHED":
            logger.info(
                "Instagram container finished: container_id=%s",
                container_id,
            )
            return

        if status_code in {"ERROR", "EXPIRED", "FAILED"}:
            raise InstagramPublishError(
                f"Instagram container failed: "
                f"container_id={container_id} "
                f"status={data.get('status') or status_code} "
                f"error={data.get('error_message') or ''}"
            )

        time.sleep(CONTAINER_POLL_INTERVAL)
        elapsed += CONTAINER_POLL_INTERVAL

    raise InstagramPublishError(
        f"Instagram container timed out: container_id={container_id}"
    )


def publish_reel(
    *,
    access_token: str,
    ig_user_id: str,
    container_id: str,
) -> str:
    """
    Publish the finished container; returns the published media id.
    """
    data = _post_json(
        f"{INSTAGRAM_GRAPH_HOST}/{API_VERSION}/{ig_user_id}/media_publish",
        {
            "creation_id": container_id,
            "access_token": access_token,
        },
    )

    media_id = data.get("id")

    if not data.get("id"):
        raise InstagramPublishError(
            f"Instagram did not return a published media id: {data}"
        )

    logger.info(
        "Instagram reel published: media_id=%s",
        media_id,
    )

    return media_id


def publish_to_instagram(
    *,
    access_token: str,
    ig_user_id: str,
    public_video_url: str,
    caption: str,
    duration: float,
) -> dict:
    """
    Full reel publishing flow. Returns {external_id, external_url}.
    """
    validate_clip_duration(duration)

    container_id = create_reel_container(
        access_token=access_token,
        ig_user_id=ig_user_id,
        public_video_url=public_video_url,
        caption=caption,
    )

    wait_for_container_ready(
        access_token=access_token,
        container_id=container_id,
    )

    media_id = publish_reel(
        access_token=access_token,
        ig_user_id=ig_user_id,
        container_id=container_id,
    )

    return {
        "external_id": media_id,
        "external_url": f"https://www.instagram.com/reel/{media_id}/",
    }