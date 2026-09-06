import logging

from app.db.sync_database import SessionLocal
from app.models.transcript_segment import TranscriptSegment
from app.models.transcript_word import TranscriptWord


logger = logging.getLogger(__name__)


def save_transcript_with_words(
    db,
    video_id: int,
    transcript: list[dict],
) -> list[TranscriptSegment]:
    """
    Persist transcript segments alongside word-level timestamps.

    Each item in ``transcript`` must contain at least:
        { "start": float, "end": float, "text": str }

    and may optionally contain:
        { "words": [ { "word": str, "start": float, "end": float }, ... ] }

    Existing segment-level functionality is preserved. Words are stored
    in the new TranscriptWord model keyed to their segment.
    """
    saved_segments = []

    for item in transcript:
        segment = TranscriptSegment(
            video_id=video_id,
            start_time=item["start"],
            end_time=item["end"],
            text=item["text"],
        )

        db.add(segment)
        db.flush()

        words = item.get("words")

        if words:
            for index, word_item in enumerate(words):
                db.add(
                    TranscriptWord(
                        segment_id=segment.id,
                        video_id=video_id,
                        word=word_item["word"],
                        start_time=word_item["start"],
                        end_time=word_item["end"],
                        order_index=index,
                    )
                )

        saved_segments.append(segment)

    logger.info(
        "Saved transcript with words: "
        "video_id=%s segments=%s",
        video_id,
        len(saved_segments),
    )

    return saved_segments
