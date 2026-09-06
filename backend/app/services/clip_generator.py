import logging
import subprocess
from pathlib import Path


logger = logging.getLogger(__name__)


def generate_clip(
    source_path: Path,
    output_path: Path,
    start_time: float,
    end_time: float,
) -> Path:
    """
    Generate a video clip using FFmpeg.
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

    command = [
        "ffmpeg",
        "-y",
        "-ss",
        str(start_time),
        "-i",
        str(source_path),
        "-t",
        str(duration),
        "-c:v",
        "libx264",
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

    logger.info(
        "Clip generated successfully: %s",
        output_path,
    )

    return output_path