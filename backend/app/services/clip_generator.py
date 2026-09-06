import logging
import subprocess
from pathlib import Path

from app.services.media_probe import probe_stream_summary


logger = logging.getLogger(__name__)


def generate_clip(
    source_path: Path,
    output_path: Path,
    start_time: float,
    end_time: float,
) -> Path:
    """
    Generate a video clip using FFmpeg.

    The clip must contain audio whenever the source does; the output is
    verified with ffprobe so a silent clip fails loudly instead of being
    published silently.
    """

    if not source_path.exists():
        raise FileNotFoundError(
            f"Source video not found: {source_path}"
        )

    if end_time <= start_time:
        raise ValueError(
            "end_time must be greater than start_time"
        )

    duration = end_time - start_time

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    source_summary = probe_stream_summary(source_path)

    command = [
        "ffmpeg",
        "-y",
        # Fast/coarse input seek (keyframe granularity) — critical for
        # long sources (e.g. a 30-min 4K video) so we don't decode from
        # the beginning on every candidate.
        "-ss",
        str(start_time),
        "-i",
        str(source_path),
        "-t",
        str(duration),
        "-vf",
        "scale=720:-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-threads",
        "4",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_path),
    ]

    logger.info(
        "Generating clip: start=%.2f end=%.2f output=%s",
        start_time,
        end_time,
        output_path,
    )

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(
            "FFmpeg failed: %s",
            result.stderr,
        )

        raise RuntimeError(
            f"FFmpeg failed: {result.stderr}"
        )

    if not output_path.exists():
        raise RuntimeError(
            f"FFmpeg did not create output: {output_path}"
        )

    output_summary = probe_stream_summary(output_path)

    if (
        source_summary["has_audio"]
        and not output_summary["has_audio"]
    ):
        raise RuntimeError(
            f"Generated clip is missing audio: {output_path}"
        )

    if not output_summary["has_video"]:
        raise RuntimeError(
            f"Generated clip is missing video: {output_path}"
        )

    logger.info(
        "Clip generated successfully: %s (audio=%s)",
        output_path,
        output_summary["has_audio"],
    )

    return output_path