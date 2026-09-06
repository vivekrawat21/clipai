import logging

from app.models.transcript_segment import TranscriptSegment
from app.services.clip_scoring import score_text
from app.services.semantic_scoring import (
    calculate_semantic_coherence,
)


logger = logging.getLogger(__name__)


def generate_candidate_windows(
    segments: list[TranscriptSegment],
    window_size: float = 30.0,
    step_size: float = 10.0,
):
    """
    Generate sliding transcript windows.

    Example:

        0-30
        10-40
        20-50
        30-60
        ...
    """

    if not segments:
        return []

    start_time = segments[0].start_time
    final_time = segments[-1].end_time

    candidates = []

    while start_time < final_time:

        end_time = start_time + window_size

        window_segments = [
            segment
            for segment in segments
            if (
                segment.start_time < end_time
                and segment.end_time > start_time
            )
        ]

        if window_segments:

            text = " ".join(
                segment.text
                for segment in window_segments
            )

            actual_start = max(
                start_time,
                window_segments[0].start_time,
            )

            actual_end = min(
                end_time,
                window_segments[-1].end_time,
            )

            candidates.append(
                {
                    "start_time": actual_start,
                    "end_time": actual_end,
                    "text": text,
                    "segments": window_segments,
                }
            )

        start_time += step_size

    logger.info(
        "Generated candidate windows: count=%s",
        len(candidates),
    )

    return candidates


def calculate_overlap(
    start_a: float,
    end_a: float,
    start_b: float,
    end_b: float,
) -> float:
    """
    Calculate overlap between two time ranges.

    Returns:
        0.0 = no overlap
        1.0 = complete overlap
    """

    intersection = max(
        0.0,
        min(end_a, end_b)
        - max(start_a, start_b),
    )

    duration_a = end_a - start_a
    duration_b = end_b - start_b

    if duration_a <= 0 or duration_b <= 0:
        return 0.0

    return intersection / min(
        duration_a,
        duration_b,
    )


def select_best_candidates(
    candidates: list[dict],
    max_candidates: int = 10,
    overlap_threshold: float = 0.5,
    min_score: float = 0.30,
    min_gap: float = 15.0,
) -> list[dict]:
    """
    Select high-quality and diverse candidates.

    Steps:

    1. Remove weak candidates.
    2. Sort by final score.
    3. Remove heavily overlapping candidates.
    4. Remove candidates that are too close together.
    5. Keep the top candidates.
    """

    # ---------------------------------
    # Remove weak candidates
    # ---------------------------------

    candidates = [
        candidate
        for candidate in candidates
        if candidate["score"] >= min_score
    ]

    # ---------------------------------
    # Highest score first
    # ---------------------------------

    candidates.sort(
        key=lambda candidate: candidate["score"],
        reverse=True,
    )

    selected = []

    # ---------------------------------
    # Select diverse candidates
    # ---------------------------------

    for candidate in candidates:

        start = candidate["start_time"]
        end = candidate["end_time"]

        reject = False

        for selected_candidate in selected:

            selected_start = (
                selected_candidate["start_time"]
            )

            selected_end = (
                selected_candidate["end_time"]
            )

            # -----------------------------
            # Check overlap
            # -----------------------------

            overlap = calculate_overlap(
                start,
                end,
                selected_start,
                selected_end,
            )

            if overlap >= overlap_threshold:

                logger.debug(
                    "Rejected overlapping candidate: "
                    "start=%.2f end=%.2f overlap=%.2f",
                    start,
                    end,
                    overlap,
                )

                reject = True
                break

            # -----------------------------
            # Check distance
            # -----------------------------

            if start >= selected_end:

                gap = start - selected_end

            elif selected_start >= end:

                gap = selected_start - end

            else:

                gap = 0.0

            if gap < min_gap:

                logger.debug(
                    "Rejected nearby candidate: "
                    "start=%.2f end=%.2f gap=%.2f",
                    start,
                    end,
                    gap,
                )

                reject = True
                break

        if reject:
            continue

        selected.append(candidate)

        if len(selected) >= max_candidates:
            break

    logger.info(
        "Selected final candidates: count=%s",
        len(selected),
    )

    return selected


def detect_clip_candidates(
    segments: list[TranscriptSegment],
):
    """
    Generate, score, and select final clip candidates.

    Final score combines:

        70% rule-based score
        30% semantic coherence
    """

    # ---------------------------------
    # Generate windows
    # ---------------------------------

    windows = generate_candidate_windows(
        segments
    )

    candidates = []

    # ---------------------------------
    # Score windows
    # ---------------------------------

    for window in windows:

        # -----------------------------
        # Rule-based score
        # -----------------------------

        rule_score, rule_reason = score_text(
            window["text"]
        )

        # -----------------------------
        # Semantic coherence
        # -----------------------------

        semantic_score = (
            calculate_semantic_coherence(
                window["segments"]
            )
        )

        # -----------------------------
        # Combine scores
        # -----------------------------

        final_score = (
            rule_score * 0.70
            + semantic_score * 0.30
        )

        # -----------------------------
        # Build reason
        # -----------------------------

        reason = (
            f"{rule_reason}; "
            f"semantic_coherence="
            f"{semantic_score:.2f}"
        )

        candidates.append(
            {
                "start_time": window["start_time"],
                "end_time": window["end_time"],
                "score": final_score,
                "rule_score": rule_score,
                "semantic_score": semantic_score,
                "reason": reason,
            }
        )

        logger.debug(
            "Candidate scored: "
            "start=%.2f end=%.2f "
            "rule=%.3f semantic=%.3f final=%.3f",
            window["start_time"],
            window["end_time"],
            rule_score,
            semantic_score,
            final_score,
        )

    logger.info(
        "Scored candidates: count=%s",
        len(candidates),
    )

    # ---------------------------------
    # Select final candidates
    # ---------------------------------

    candidates = select_best_candidates(
        candidates,
        max_candidates=5,
        overlap_threshold=0.5,
        min_score=0.30,
        min_gap=15.0,
    )

    return candidates