import gc
import logging
from pathlib import Path

from faster_whisper import WhisperModel


logger = logging.getLogger(__name__)


MODEL_SIZE = "base"

_model = None


def _get_model() -> WhisperModel:
    """Load the Whisper model on first use (not at import time)."""
    global _model
    if _model is None:
        logger.info(
            "Loading Whisper model: %s",
            MODEL_SIZE,
        )

        _model = WhisperModel(
            MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )

    return _model


def release_model() -> None:
    """Drop the cached Whisper model and free its memory."""
    global _model
    if _model is not None:
        logger.info("Releasing Whisper model: %s", MODEL_SIZE)
        _model = None
        gc.collect()


def transcribe_audio(
    audio_path: Path,
    include_words: bool = True,
):
    """
    Transcribe audio with faster-whisper.

    When include_words is True (default), each segment will include
    a ``words`` list of word-level timestamp dicts:
        { "word": "...", "start": 0.0, "end": 0.45 }

    The existing segment-level fields (start/end/text) are preserved so
    the current downstream pipeline continues to work unchanged.
    """
    logger.info(
        "Starting transcription: audio=%s include_words=%s",
        audio_path,
        include_words,
    )

    segments, info = _get_model().transcribe(
        str(audio_path),
        beam_size=5,
        word_timestamps=include_words,
    )

    transcript = []

    for segment in segments:
        item = {
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
        }

        words = getattr(segment, "words", None)

        if include_words and words:
            item["words"] = [
                {
                    "word": word.word,
                    "start": float(word.start),
                    "end": float(word.end),
                }
                for word in words
                if word.word is not None
            ]

        transcript.append(item)

    logger.info(
        "Transcription completed: segments=%s language=%s",
        len(transcript),
        info.language,
    )

    return transcript
