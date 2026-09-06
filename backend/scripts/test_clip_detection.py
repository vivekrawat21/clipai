import logging

from app.db.sync_database import SessionLocal
from app.models.transcript_segment import TranscriptSegment
from app.services.clip_detection import detect_clip_candidates


logging.basicConfig(level=logging.INFO)

db = SessionLocal()

try:
    video_id = 14

    segments = (
        db.query(TranscriptSegment)
        .filter(
            TranscriptSegment.video_id == video_id
        )
        .order_by(
            TranscriptSegment.start_time
        )
        .all()
    )

    print(f"Found {len(segments)} transcript segments")

    candidates = detect_clip_candidates(segments)

    print("\nTop candidates:\n")

    for candidate in candidates[:10]:
        print(
            f"{candidate['start_time']:.2f}"
            f" → "
            f"{candidate['end_time']:.2f}"
            f" | final="
            f"{candidate['score']:.3f}"
            f" | rule="
            f"{candidate['rule_score']:.3f}"
            f" | semantic="
            f"{candidate['semantic_score']:.3f}"
            f" | {candidate['reason']}"
        )

finally:
    db.close()