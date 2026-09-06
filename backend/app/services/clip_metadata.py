"""
Clip metadata generation for publishing.

Turns a rendered clip's transcript into quick publish-ready copy:

    * YouTube title — a hook built from the clip's opening words
    * YouTube description — hook + CTA + hashtags
    * Instagram caption — hook + CTA + hashtags
    * hashtags — the clip's most distinctive recurring words

Everything is deterministic and lightweight (no LLM calls), so the
output is stable across re-renders and the renderer can reuse the same
hook for the on-video hook banner.
"""
import logging
import re
from collections import Counter
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Words unlikely to make a strong standalone hook.
INTRO_FILLERS = frozenset(
    {
        "so",
        "and",
        "but",
        "or",
        "like",
        "okay",
        "ok",
        "um",
        "uh",
        "hm",
        "well",
        "yeah",
        "yah",
        "yep",
        "oh",
        "ah",
    }
)

# Low-information words skipped when ranking hashtags.
STOPWORDS = frozenset(
    {
        "a", "an", "the", "and", "but", "or", "for", "nor", "so", "yet",
        "of", "to", "in", "on", "at", "by", "with", "from", "as", "into",
        "onto", "out", "up", "down", "off", "over", "under", "again",
        "then", "once", "here", "there", "when", "where", "why", "how",
        "all", "any", "both", "each", "few", "more", "most", "other",
        "some", "such", "no", "not", "only", "own", "same", "than", "that",
        "these", "this", "those", "too", "very", "just", "about", "would",
        "could", "should", "will", "can", "did", "does", "doing", "have",
        "has", "had", "having", "was", "were", "been", "being", "is", "are",
        "am", "it", "its", "which", "who", "whom", "what", "if", "because",
        "while", "before", "after", "amid", "between", "among", "make",
        "makes", "made", "get", "gets", "got", "going", "want", "wants",
        "know", "knows", "think", "thinks", "really", "actually", "maybe",
        "right", "okay", "gonna", "wanna", "that's", "don't", "you're",
        "it's", "we're", "they're", "i'm", "you'll", "yeah", "like",
        "literally", "honestly", "absolutely", "definitely", "actually",
        "really", "honestly", "basically", "probably", "sure", "guess",
        "stuff", "things", "thing", "kind", "sort", "way", "lot", "bit",
        "always", "give", "given", "got", "gotta", "bro", "dude", "man",
        "guys", "guy", "even", "still", "also", "around", "back", "every",
        "everyone", "anyone", "someone", "ones", "one", "day", "time",
        "nice", "great", "good", "ok", "let", "let's", "oh", "ah",
    }
)

_HASHTAG_LENGTH_MIN = 4
_HASHTAG_LIMIT = 5


@dataclass(frozen=True)
class ClipPublishMetadata:
    title: str
    description: str
    caption: str
    hashtags: list[str]
    hook: str


def join_transcript(words: list[str]) -> str:
    """Join word tokens into a single transcript string."""
    return " ".join(word.strip() for word in words if word and word.strip())


def build_hook(
    transcript: str,
    *,
    fallback: str = "Watch this",
) -> str:
    """
    Build a punchy, capitalized hook from the clip's opening words.

    Filler openers ("so", "okay", "like", ...) are skipped when they
    weaken the hook. The result is limited to a few words and ~60 chars
    so it survives as a YouTube title and on-video banner text.
    """
    words = [
        w.strip(".,!?;:\"'“”")
        for w in re.split(r"\s+", transcript.strip())
    ]
    words = [w for w in words if w]

    if not words:
        return fallback

    while (
        words
        and words[0].lower() in INTRO_FILLERS
    ):
        words.pop(0)

    if not words:
        return fallback

    taken: list[str] = []
    total = 0

    for word in words:
        # Collapse stutter/doubled openers ("ones ones ones" → "ones").
        if taken and word.lower() == taken[-1].lower():
            continue
        if total + len(word) + 1 > 58:
            break
        taken.append(word)
        total += len(word) + 1

    truncated = total >= 56 and len(taken) < len(words)

    hook = " ".join(
        word[0].upper() + word[1:]
        for word in taken
    )

    if truncated:
        return hook[:57].rstrip() + "..."

    return hook


def build_hashtags(
    transcript: str,
    *,
    limit: int = _HASHTAG_LIMIT,
) -> list[str]:
    """
    Pick up to ``limit`` distinctive keywords from the transcript.

    Words are ranked by how often they recur (weak signal that the clip
    is really about them) with longer words winning ties.
    """
    candidates = [
        w
        for w in re.findall(r"[a-zA-Z]{4,}", transcript.lower())
        if w not in STOPWORDS
        and not w.isdigit()
    ]

    if len(candidates) < 6:
        return []

    counts = Counter(candidates)

    ranked = sorted(
        counts,
        key=lambda w: (counts[w], len(w)),
        reverse=True,
    )

    return ranked[:limit]


def build_metadata(
    transcript: str,
    *,
    video_title: str | None = None,
) -> ClipPublishMetadata:
    """
    Build the full publish copy for a clip.
    """
    hook = build_hook(transcript)
    hashtags = build_hashtags(transcript)

    tag_line = " ".join(f"#{tag}" for tag in hashtags)

    description_parts = [hook]

    if video_title:
        description_parts.append("")
        description_parts.append(f"From: {video_title}")

    description_parts.append("")
    description_parts.append("Full episode on the channel — follow for more clips like this.")

    if tag_line:
        description_parts.append("")
        description_parts.append(tag_line)

    caption_parts = [hook]
    caption_parts.append("")
    caption_parts.append("Follow for more clips like this.")

    if hashtags:
        caption_parts.append("")
        caption_parts.extend(f"#{tag}" for tag in hashtags)

    return ClipPublishMetadata(
        title=hook[:100],
        description="\n".join(description_parts),
        caption="\n".join(caption_parts),
        hashtags=hashtags,
        hook=hook,
    )