"""
YouTube publishing service.

Implements the official YouTube Data API v3 resumable upload protocol
for videos (including Shorts):

    1. POST https://www.googleapis.com/upload/youtube/v3/videos
           ?uploadType=resumable&part=snippet,status
       Body: JSON metadata (title, description, tags, privacyStatus)
       Response header Location → resumable session URL
    2. PUT the session URL with the raw video bytes

Uses the youtube.upload OAuth scope. Uploads are idempotent by design:
the caller should persist the returned external_id so a retry does not
publish the same clip twice.
"""
import logging

import requests


logger = logging.getLogger(__name__)


YOUTUBE_UPLOAD_URL = (
    "https://www.googleapis.com/upload/youtube/v3/videos"
)

CHUNK_SIZE = 1024 * 1024  # 1 MiB chunks


class YouTubePublishError(Exception):
    """Raised for unresolvable YouTube publishing failures."""


def _auth_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
    }


def start_resumable_session(
    *,
    access_token: str,
    title: str,
    description: str,
    privacy_status: str = "public",
) -> tuple[str, str]:
    """
    Start a resumable session.

    Returns (session_location_url, video_resource_id_if_immediate).
    """
    body = {
        "snippet": {
            "title": title,
            "description": description,
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
            "madeForKids": False,
        },
    }

    headers = {
        **_auth_headers(access_token),
        "Content-Type": "application/json; charset=UTF-8",
    }

    try:
        response = requests.post(
            YOUTUBE_UPLOAD_URL,
            params={
                "uploadType": "resumable",
                "part": "snippet,status",
            },
            headers=headers,
            json=body,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise YouTubePublishError(
            f"YouTube upload session request failed: {exc}"
        )

    if response.status_code >= 400:
        logger.error(
            "YouTube upload session error: status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise YouTubePublishError(
            f"YouTube upload session error {response.status_code}: "
            f"{response.text}"
        )

    location = response.headers.get("Location")

    if not location:
        raise YouTubePublishError(
            "YouTube did not return a resumable session Location header"
        )

    return location, response.text


def _upload_bytes(
    session_url: str,
    video_bytes: bytes,
    access_token: str,
) -> dict:
    """
    PUT the video payload to the resumable session URL.

    Uses a simple single-PUT with the full file (the session supports
    chunked PUTs via Content-Range; a full PUT is acceptable for short
    clips and massively simpler while staying on the official API).
    """
    headers = {
        **_auth_headers(access_token),
        "Content-Type": "video/*",
        "Content-Length": str(len(video_bytes)),
    }

    try:
        response = requests.put(
            session_url,
            headers=headers,
            data=video_bytes,
            timeout=300,
        )
    except requests.RequestException as exc:
        raise YouTubePublishError(
            f"YouTube upload failed: {exc}"
        )

    if response.status_code >= 400:
        logger.error(
            "YouTube upload error: status=%s body=%s",
            response.status_code,
            response.text[:2000],
        )
        raise YouTubePublishError(
            f"YouTube upload error {response.status_code}: "
            f"{response.text[:2000]}"
        )

    try:
        return response.json()
    except ValueError:
        return {}


def publish_to_youtube(
    *,
    access_token: str,
    video_path: str,
    title: str,
    description: str,
    privacy_status: str = "public",
) -> dict:
    """
    Full YouTube upload flow. Returns {external_id, external_url}.
    """
    from pathlib import Path

    path = Path(video_path)

    if not path.exists():
        raise YouTubePublishError(
            f"Video file not found: {path}"
        )

    session_url, _ = start_resumable_session(
        access_token=access_token,
        title=title,
        description=description,
        privacy_status=privacy_status,
    )

    video_bytes = path.read_bytes()

    resource = _upload_bytes(
        session_url,
        video_bytes,
        access_token,
    )

    video_id = resource.get("id")

    # A video id of "pending" means processing is ongoing asynchronously.
    if not video_id or video_id == "pending":
        raise YouTubePublishError(
            f"YouTube did not confirm an uploaded video id: {resource}"
        )

    logger.info(
        "YouTube video uploaded: video_id=%s",
        video_id,
    )

    return {
        "external_id": video_id,
        "external_url": f"https://www.youtube.com/watch?v={video_id}",
    }