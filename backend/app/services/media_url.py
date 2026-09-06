"""
Public media URL layer.

Publishing services must obtain a publicly reachable HTTPS media URL for
a final rendered clip — never a local filesystem path. This module is the
single abstraction through which file paths are translated into URLs.

For development, the app itself serves the clip through the preview
endpoint (PUBLIC_BASE_URL). For production, this module can be extended
to return object-storage/  CDN URLs (S3 presigned or CDN domain) while
the publishing services remain unchanged.
"""
import logging

from app.core.config import settings


logger = logging.getLogger(__name__)


def get_public_clip_url(clip_id: int) -> str:
    """
    Return a publicly reachable URL for a rendered clip's MP4.

    Dev mode: the ClipAI API serves the file at /clips/{id}/preview.
    Production: swap this implementation to resolve against S3/CDN.
    """
    base = settings.PUBLIC_BASE_URL.rstrip("/")

    # If S3/CDN is configured in the future, prefer it here.
    # if settings.S3_ENDPOINT: ...
    url = f"{base}/clips/{clip_id}/preview"

    logger.debug(
        "Resolved public clip URL: clip_id=%s url=%s",
        clip_id,
        url,
    )

    return url


def get_public_clip_url_for_path(clip_id: int, _file_path: str) -> str:
    """
    Variant that accepts the local file path for forward-compat with
    object storage (ignored in dev mode).
    """
    return get_public_clip_url(clip_id)