from app.db.sync_database import SessionLocal
from app.models.transcript_segment import TranscriptSegment
from app.services.semantic_scoring import (
    calculate_semantic_coherence,
)


db = SessionLocal()

try:
    segments = (
        db.query(TranscriptSegment)
        .filter(
            TranscriptSegment.video_id == 14,
            TranscriptSegment.embedding.is_not(None),
        )
        .order_by(
            TranscriptSegment.start_time
        )
        .limit(10)
        .all()
    )

    print(
        "Segments:",
        len(segments),
    )

    score = calculate_semantic_coherence(
        segments
    )

    print(
        "Semantic coherence:",
        round(score, 4),
    )

finally:
    db.close()