import logging

from app.db.sync_database import SessionLocal
from app.models.transcript_segment import TranscriptSegment
from app.services.embeddings import q


logging.basicConfig(
    level=logging.INFO,
)

logger = logging.getLogger(__name__)


def embed_transcript_segments(
    video_id: int,
) -> None:

    db = SessionLocal()

    try:
        segments = (
            db.query(TranscriptSegment)
            .filter(
                TranscriptSegment.video_id == video_id,
                TranscriptSegment.embedding.is_(None),
            )
            .order_by(
                TranscriptSegment.start_time
            )
            .all()
        )

        logger.info(
            "Found segments without embeddings: "
            "video_id=%s count=%s",
            video_id,
            len(segments),
        )

        if not segments:
            logger.info(
                "No segments require embeddings."
            )
            return

        texts = [
            segment.text
            for segment in segments
        ]

        logger.info(
            "Generating embeddings: count=%s",
            len(texts),
        )

        embeddings = (
            q.generate_embeddings(
                texts
            )
        )

        if len(embeddings) != len(segments):
            raise RuntimeError(
                "Embedding count does not match "
                "transcript segment count"
            )

        for segment, embedding in zip(
            segments,
            embeddings,
        ):
            segment.embedding = embedding

        db.commit()

        logger.info(
            "Embeddings saved successfully: "
            "video_id=%s count=%s",
            video_id,
            len(segments),
        )

    except Exception:
        db.rollback()

        logger.exception(
            "Failed to generate embeddings: "
            "video_id=%s",
            video_id,
        )

        raise

    finally:
        db.close()


if __name__ == "__main__":
    embed_transcript_segments(
        video_id=14,
    )