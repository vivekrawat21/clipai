import logging
from pathlib import Path

from faster_whisper import WhisperModel


logger = logging.getLogger(__name__)


MODEL_SIZE = "small"

model = WhisperModel(
    MODEL_SIZE,
    device="cpu",
    compute_type="int8",
)


def transcribe_audio(
    audio_path: Path,
):
    logger.info(
        "Starting transcription: audio=%s",
        audio_path,
    )

    segments, info = model.transcribe(
        str(audio_path),
        beam_size=5,
    )

    transcript = []

    for segment in segments:
        transcript.append(
            {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
            }
        )

    logger.info(
        "Transcription completed: segments=%s language=%s",
        len(transcript),
        info.language,
    )

    return transcript