import logging

from youtube_transcript_api import YouTubeTranscriptApi


logger = logging.getLogger(__name__)


def get_youtube_transcript(youtube_id: str):
    logger.info(
        "Trying YouTube transcript: youtube_id=%s",
        youtube_id,
    )

    api = YouTubeTranscriptApi()

    try:
        transcript = api.fetch(youtube_id)

    except Exception:
        logger.exception(
            "YouTube transcript unavailable: youtube_id=%s",
            youtube_id,
        )
        return None

    segments = []

    for item in transcript:
        segments.append(
            {
                "start": float(item.start),
                "end": float(item.start + item.duration),
                "text": item.text.strip(),
            }
        )

    logger.info(
        "YouTube transcript retrieved: youtube_id=%s segments=%s",
        youtube_id,
        len(segments),
    )

    return segments