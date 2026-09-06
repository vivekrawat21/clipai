"""
Subtitle service.

Responsible for:
    * finding transcript words belonging to a clip
    * converting timestamps from global video time to clip-relative time
    * grouping words into readable subtitle phrases
    * generating subtitle data
    * generating ASS/SRT subtitle files for FFmpeg

This service is intentionally decoupled from FastAPI. It receives a
SQLAlchemy session (sync or async) so it can be used from both the
Celery workers and the API.
"""
import logging
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

from app.models.clip import Clip
from app.models.transcript_word import TranscriptWord
from app.services.subtitle_style import SubtitleStyle


logger = logging.getLogger(__name__)


@dataclass
class SubtitleWord:
    """A single word with clip-relative timing."""

    text: str
    start: float
    end: float


@dataclass
class SubtitleLine:
    """A grouped phrase of several words."""

    words: list[SubtitleWord]
    start: float
    end: float

    @property
    def text(self) -> str:
        return " ".join(word.text for word in self.words)


@dataclass
class SubtitleData:
    """Full subtitle payload for a clip."""

    lines: list[SubtitleLine]
    style: SubtitleStyle


async def fetch_clip_words(
    db,
    clip: Clip,
) -> list[TranscriptWord]:
    """
    Find transcript words belonging to a clip's time range.

    Words are matched against the segment time range because the clip
    boundaries are segment-based (candidate windows align to segments).
    To be safe, we also filter words by the clip's exact start/end.
    """
    result = await db.execute(
        select(TranscriptWord)
        .where(
            TranscriptWord.video_id == clip.video_id,
            TranscriptWord.start_time < clip.end_time,
            TranscriptWord.end_time > clip.start_time,
        )
        .order_by(
            TranscriptWord.start_time.asc(),
            TranscriptWord.order_index.asc(),
        )
    )

    words = result.scalars().all()

    return words


def to_clip_relative(
    clip_start: float,
    words: list[TranscriptWord],
) -> list[SubtitleWord]:
    """
    Convert global video timestamps to clip-relative timestamps.
    """
    relative = []

    for word in words:
        start = max(0.0, word.start_time - clip_start)
        end = max(0.0, word.end_time - clip_start)

        if end <= start:
            continue

        relative.append(
            SubtitleWord(
                text=word.word,
                start=start,
                end=end,
            )
        )

    return relative


def dedupe_words(
    words: list[SubtitleWord],
) -> list[SubtitleWord]:
    """
    Drop consecutive words that are exact duplicates (same text and
    timestamps). Re-processing a video can leave identical rows behind
    (same word inserted multiple times); keeping only the first keeps
    chunking and karaoke highlighting clean.
    """
    if not words:
        return []

    deduped = []
    previous_key = None

    for word in words:
        key = (
            word.text,
            round(word.start, 3),
            round(word.end, 3),
        )

        if key != previous_key:
            deduped.append(word)

        previous_key = key

    return deduped


def group_words_into_lines(
    words: list[SubtitleWord],
    words_per_line: int,
) -> list[SubtitleLine]:
    """
    Group words into readable subtitle phrases.

    Words are grouped into fixed-size groups with a cap per line.
    Leading/trailing punctuation is stripped from the phrase but words
    are not re-ordered or split mid-word.
    """
    if not words:
        return []

    lines = []

    for index in range(0, len(words), words_per_line):
        group = words[index : index + words_per_line]

        first = group[0]
        last = group[-1]

        # Trim trivia punctuation around the line text but keep
        # word-level timing untouched.
        text = " ".join(w.text for w in group)
        cleaned_text = " ".join(
            text.strip("...!?.,;:")
            .split()
        )

        if not cleaned_text:
            continue

        lines.append(
            SubtitleLine(
                words=group,
                start=first.start,
                end=last.end,
            )
        )

    return lines


async def build_subtitle_data_async(
    db,
    clip: Clip,
    style: SubtitleStyle | None = None,
) -> SubtitleData:
    """
    Build structured subtitle data for a clip (async session variant).
    """
    style = style or SubtitleStyle.default()

    db_words = await fetch_clip_words(db, clip)

    if not db_words:
        return SubtitleData(
            lines=[],
            style=style,
        )

    relative_words = to_clip_relative(
        clip.start_time,
        db_words,
    )

    lines = group_words_into_lines(
        dedupe_words(relative_words),
        style.words_per_line,
    )

    return SubtitleData(
        lines=lines,
        style=style,
    )


def build_subtitle_data_sync(
    db,
    clip: Clip,
    style: SubtitleStyle | None = None,
) -> SubtitleData:
    """
    Build structured subtitle data for a clip (sync session variant,
    used inside Celery workers).
    """
    style = style or SubtitleStyle.default()

    db_words = (
        db.query(TranscriptWord)
        .filter(
            TranscriptWord.video_id == clip.video_id,
            TranscriptWord.start_time < clip.end_time,
            TranscriptWord.end_time > clip.start_time,
        )
        .order_by(
            TranscriptWord.start_time.asc(),
            TranscriptWord.order_index.asc(),
        )
        .all()
    )

    if not db_words:
        return SubtitleData(
            lines=[],
            style=style,
        )

    relative_words = to_clip_relative(
        clip.start_time,
        db_words,
    )

    lines = group_words_into_lines(
        dedupe_words(relative_words),
        style.words_per_line,
    )

    return SubtitleData(
        lines=lines,
        style=style,
    )


def write_subtitle_file(
    subtitle_data: SubtitleData,
    output_path: Path,
    fmt: str = "ass",
    width: int = 1080,
    height: int = 1920,
    hook_text: str = "",
) -> Path:
    """
    Generate an ASS or SRT subtitle file for FFmpeg.
    """
    from app.services.subtitle_format import write_ass, write_srt
    from app.services.clip_metadata import build_hook

    logger.info(
        "Writing subtitle file: fmt=%s path=%s lines=%s",
        fmt,
        output_path,
        len(subtitle_data.lines),
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if fmt.lower() == "srt":
        return write_srt(
            subtitle_data.lines,
            output_path,
        )

    if fmt.lower() == "ass":

        if not hook_text:
            transcript = " ".join(
                word.text
                for line in subtitle_data.lines
                for word in line.words
            )
            hook_text = build_hook(transcript)

        return write_ass(
            subtitle_data.lines,
            subtitle_data.style,
            output_path,
            width=width,
            height=height,
            hook_text=hook_text,
        )

    raise ValueError(
        f"Unsupported subtitle format: {fmt}"
    )