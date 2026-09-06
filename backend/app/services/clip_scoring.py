import logging
import re


logger = logging.getLogger(__name__)


# ---------------------------------
# Strong curiosity / emotional /
# surprising signals.
# ---------------------------------

HOOK_WORDS = {
    "impossible",
    "insane",
    "crazy",
    "amazing",
    "shocking",
    "secret",
    "mistake",
    "never",
    "nobody",
    "everyone",
    "unbelievable",
    "unexpected",
    "surprising",
    "ridiculous",
    "wild",
    "incredible",
    "dangerous",
    "worst",
    "best",
    "weird",
    "strange",
    "critical",
    "important",
}


# ---------------------------------
# Question / curiosity words.
#
# These are weaker than hook words.
# ---------------------------------

QUESTION_WORDS = {
    "what",
    "why",
    "how",
    "when",
    "where",
    "who",
}


# ---------------------------------
# Words that often indicate an
# important conclusion or insight.
# ---------------------------------

IMPACT_WORDS = {
    "because",
    "therefore",
    "result",
    "resulted",
    "changed",
    "change",
    "realized",
    "learned",
    "discovered",
    "revealed",
    "finally",
    "actually",
    "truth",
    "reason",
    "important",
    "lesson",
}


def clean_word(word: str) -> str:
    """
    Remove punctuation and normalize a word.
    """

    return re.sub(
        r"[^\w']",
        "",
        word.lower(),
    )


def count_question_sentences(text: str) -> int:
    """
    Count actual question sentences.

    Example:

        "Why did this happen? What happened next?"

    Returns:

        2
    """

    questions = re.findall(
        r"[^.!?]*\?",
        text,
    )

    return len(questions)


def calculate_vocabulary_diversity(
    words: list[str],
) -> float:
    """
    Calculate vocabulary diversity.

    Returns:
        Value between 0.0 and 1.0.
    """

    if not words:
        return 0.0

    return len(set(words)) / len(words)


def score_text(
    text: str,
) -> tuple[float, str]:
    """
    Score a transcript window for potential
    clip-worthiness.

    Signals:

    - strong hook words
    - question words
    - actual questions
    - impact words
    - exclamations
    - context length
    - vocabulary diversity
    - repetition
    - excessive punctuation

    Returns:

        (
            score between 0.0 and 1.0,
            explanation
        )
    """

    # =================================
    # Validate input
    # =================================

    if not text or not text.strip():
        return 0.0, "empty transcript"

    # =================================
    # Clean words
    # =================================

    words = text.split()

    cleaned_words = [
        clean_word(word)
        for word in words
    ]

    cleaned_words = [
        word
        for word in cleaned_words
        if word
    ]

    if not cleaned_words:
        return 0.0, "empty transcript"

    unique_words = set(cleaned_words)

    score = 0.0
    reasons = []

    # =================================
    # 1. Strong hook words
    # =================================

    hook_matches = (
        unique_words.intersection(
            HOOK_WORDS
        )
    )

    if hook_matches:

        hook_score = min(
            len(hook_matches) * 0.08,
            0.24,
        )

        score += hook_score

        reasons.append(
            "hooks="
            + ", ".join(
                sorted(hook_matches)
            )
        )

    # =================================
    # 2. Question words
    # =================================
    #
    # Weak signal only.
    #
    # "what", "why", "how" appearing
    # naturally should not dominate scoring.
    # =================================

    question_word_matches = (
        unique_words.intersection(
            QUESTION_WORDS
        )
    )

    if question_word_matches:

        question_word_score = min(
            len(question_word_matches) * 0.01,
            0.04,
        )

        score += question_word_score

        reasons.append(
            "question_words="
            + ", ".join(
                sorted(question_word_matches)
            )
        )

    # =================================
    # 3. Actual questions
    # =================================

    question_count = count_question_sentences(
        text
    )

    if question_count:

        question_score = min(
            question_count * 0.04,
            0.12,
        )

        score += question_score

        reasons.append(
            f"questions={question_count}"
        )

    # =================================
    # 4. Impact words
    # =================================

    impact_matches = (
        unique_words.intersection(
            IMPACT_WORDS
        )
    )

    if impact_matches:

        impact_score = min(
            len(impact_matches) * 0.03,
            0.12,
        )

        score += impact_score

        reasons.append(
            "impact="
            + ", ".join(
                sorted(impact_matches)
            )
        )

    # =================================
    # 5. Exclamations
    # =================================

    exclamation_count = text.count("!")

    if exclamation_count:

        exclamation_score = min(
            exclamation_count * 0.04,
            0.08,
        )

        score += exclamation_score

        reasons.append(
            f"exclamations={exclamation_count}"
        )

    # =================================
    # 6. Context length
    # =================================

    word_count = len(cleaned_words)

    if 40 <= word_count <= 100:

        score += 0.15

        reasons.append(
            "good_context"
        )

    elif 25 <= word_count < 40:

        score += 0.08

        reasons.append(
            "moderate_context"
        )

    elif 15 <= word_count < 25:

        score += 0.03

        reasons.append(
            "short_context"
        )

    elif word_count > 100:

        score += 0.05

        reasons.append(
            "long_context"
        )

    # =================================
    # 7. Vocabulary diversity
    # =================================

    diversity = calculate_vocabulary_diversity(
        cleaned_words
    )

    if diversity >= 0.70:

        score += 0.15

        reasons.append(
            "high_vocabulary_diversity"
        )

    elif diversity >= 0.55:

        score += 0.08

        reasons.append(
            "moderate_vocabulary_diversity"
        )

    elif diversity < 0.40:

        score -= 0.15

        reasons.append(
            "high_repetition"
        )

    elif diversity < 0.55:

        score -= 0.05

        reasons.append(
            "moderate_repetition"
        )

    # =================================
    # 8. Very short content penalty
    # =================================

    if word_count < 15:

        score -= 0.10

        reasons.append(
            "too_short"
        )

    # =================================
    # 9. Excessive punctuation penalty
    # =================================

    punctuation_count = len(
        re.findall(
            r"[!?]",
            text,
        )
    )

    if punctuation_count > 8:

        score -= 0.05

        reasons.append(
            "excessive_punctuation"
        )

    # =================================
    # 10. Normalize score
    # =================================

    score = max(
        0.0,
        min(score, 1.0),
    )

    reason = "; ".join(reasons)

    logger.debug(
        "Scored transcript window: "
        "score=%.3f reason=%s",
        score,
        reason,
    )

    return score, reason