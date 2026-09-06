import logging
from pathlib import Path

from app.services.wisper_transcription import transcribe_audio
from app.services.wisper_transcription import transcribe_audio
from app.services.youtube_transcription import get_youtube_transcript

logger = logging.getLogger(__name__)


def get_transcript(
    youtube_id: str,
    audio_path: Path | None = None,
):
    logger.info(
        "Starting transcript retrieval: youtube_id=%s",
        youtube_id,
    )

    # First try YouTube captions
    transcript = get_youtube_transcript(youtube_id)

    if transcript:
        logger.info(
            "Using YouTube transcript: youtube_id=%s",
            youtube_id,
        )

        return {
            "source": "youtube",
            "segments": transcript,
        }

    # Fall back to Whisper
    if audio_path is None:
        raise ValueError(
            "audio_path is required when YouTube transcript is unavailable"
        )

    logger.info(
        "YouTube transcript unavailable; falling back to Whisper: "
        "youtube_id=%s",
        youtube_id,
    )

    transcript = transcribe_audio(audio_path)

    return {
        "source": "whisper",
        "segments": transcript,
    }