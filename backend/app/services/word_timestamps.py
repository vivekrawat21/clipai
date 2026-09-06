import logging

from app.db.sync_database import SessionLocal
from app.models.transcript_segment import TranscriptSegment
from app.models.transcript_word import TranscriptWord


logger = logging.getLogger(__name__)


def _estimate_word_timestamps(
    text: str,
    start_time: float,
    end_time: float,
) -> list[dict]:
    """
    Estimate per-word timestamps for text that lacks native word-level
    data (e.g. YouTube transcripts). Words are distributed proportionally
    to their character length across the segment duration.

    This is a clean fallback: it never breaks the existing transcript path
    and simply approximates timestamps where the source doesn't provide them.
    """
    words = text.split()

    if not words:
        return []

    total_chars = sum(len(w) for w in words)

    if total_chars == 0:
        return []

    duration = end_time - start_time
    cursor = start_time

    result = []

    for word in words:
        word_duration = (
            duration * (len(word) / total_chars)
        )

        result.append(
            {
                "word": word,
                "start": cursor,
                "end": cursor + word_duration,
            }
        )

        cursor += word_duration

    return result


def ensure_word_timestamps(
    db,
    video_id: int,
) -> None:
    """
    Backfill word-level timestamps for any transcript segments that do
    not yet have words stored. Used when the transcript source (e.g.
    YouTube) does not provide native word timestamps.
    """

    from sqlalchemy import func

    segments_without_words = (
        db.query(TranscriptSegment)
        .outerjoin(
            TranscriptWord,
            TranscriptWord.segment_id == TranscriptSegment.id,
        )
        .filter(
            TranscriptSegment.video_id == video_id,
            TranscriptWord.id.is_(None),
        )
        .order_by(
            TranscriptSegment.start_time
        )
        .all()
    )

    if not segments_without_words:
        return

    logger.info(
        "Backfilling word timestamps: "
        "video_id=%s segments=%s",
        video_id,
        len(segments_without_words),
    )

    for segment in segments_without_words:
        words = _estimate_word_timestamps(
            segment.text,
            segment.start_time,
            segment.end_time,
        )

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

    logger.info(
        "Word timestamps backfilled: "
        "video_id=%s",
        video_id,
    )
