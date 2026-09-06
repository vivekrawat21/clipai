import logging
import subprocess
from pathlib import Path


logger = logging.getLogger(__name__)


def extract_audio(
    video_path: Path,
    audio_path: Path,
) -> Path:
    logger.info(
        "Extracting audio: video=%s audio=%s",
        video_path,
        audio_path,
    )

    audio_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(audio_path),
    ]

    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )

    except subprocess.CalledProcessError as exc:
        logger.error(
            "FFmpeg audio extraction failed: return_code=%s",
            exc.returncode,
        )

        logger.error(
            "FFmpeg stderr: %s",
            exc.stderr,
        )

        raise

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Audio file was not created: {audio_path}"
        )

    logger.info(
        "Audio extraction completed: path=%s",
        audio_path,
    )

    return audio_path