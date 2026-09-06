"""
Lightweight FFprobe helpers used to guard the clip pipeline.

These verify that media files carry the streams the pipeline depends
on, so "silent" clips fail loudly instead of silently shipping broken
output.
"""
import logging
import subprocess
from pathlib import Path


logger = logging.getLogger(__name__)


def probe_stream_summary(media_path: Path) -> dict:
    """
    Return a summary of the streams in ``media_path``.

    Example:

        {"has_video": True, "has_audio": True}
    """
    result = {
        "has_video": False,
        "has_audio": False,
    }

    if not media_path.exists():
        return result

    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "stream=codec_type",
                "-of",
                "csv=p=0",
                str(media_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning(
            "ffprobe failed for %s: %s",
            media_path,
            exc,
        )
        return result

    if proc.returncode != 0:
        logger.warning(
            "ffprobe error for %s: %s",
            media_path,
            proc.stderr[-500:],
        )
        return result

    for line in proc.stdout.splitlines():
        codec_type = line.strip().lower()
        if codec_type == "video":
            result["has_video"] = True
        elif codec_type == "audio":
            result["has_audio"] = True

    return result


def has_audio(media_path: Path) -> bool:
    """True if ``media_path`` contains at least one audio stream."""
    return probe_stream_summary(media_path)["has_audio"]