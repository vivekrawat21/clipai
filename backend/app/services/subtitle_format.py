"""
Subtitle file format writers (SRT + ASS).

Kept separate from the subtitle service so the file-format knowledge
lives in one place and can be tested independently.
"""
from pathlib import Path


def _hex_to_ass(color: str) -> str:
    """
    Convert "#RRGGBB" (or "#AARRGGBB") to ASS "&HAABBGGRR&" format.

    ASS uses the Alpha channel as the leading byte (00 = opaque,
    FF = transparent). Properly emitting it first is required for
    semi-transparent shadow/background colors to work as intended.
    """
    value = color.lstrip("#")

    if len(value) == 6:
        r, g, b = value[0:2], value[2:4], value[4:6]
        return f"&H{b}{g}{r}&"

    if len(value) == 8:
        # AARRGGBB assumed (alpha, red, green, blue)
        a, r, g, b = (
            value[0:2],
            value[2:4],
            value[4:6],
            value[6:8],
        )
        return f"&H{a}{b}{g}{r}&"

    raise ValueError(f"Unsupported color format: {color}")


def _format_srt_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0

    ms = int(round((seconds % 1) * 1000))
    total_seconds = int(seconds)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)

    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def _format_ass_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0

    ms = int(round((seconds % 1) * 100))
    carry, ms = divmod(ms, 100)
    total_seconds = int(seconds) + carry
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)

    return f"{hours:d}:{minutes:02d}:{secs:02d}.{ms:02d}"


def _esc(text: str) -> str:
    """Escape ASS override-tag braces in plain text."""
    return text.replace("{", "｛").replace("}", "｝")


def _esc_srt(text: str) -> str:
    return text.replace("-->", "->")


def write_srt(
    lines,
    output_path: Path,
) -> Path:
    """
    Write structured subtitle lines (list of objects with ``start``,
    ``end`` and ``text``) to a plain SRT file.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    blocks = []

    for index, line in enumerate(lines, start=1):
        blocks.append(
            f"{_format_srt_timestamp(line.start)} --> "
            f"{_format_srt_timestamp(line.end)}"
        )
        blocks.append(_esc_srt(line.text))
        blocks.append("")

    output_path.write_text("\n".join(blocks), encoding="utf-8")

    return output_path


def write_ass(
    lines,
    style,
    output_path: Path,
    width: int = 1080,
    height: int = 1920,
    hook_text: str = "",
) -> Path:
    """
    Write structured subtitle lines to an ASS file with support for
    per-word highlighting (karaoke-style animation).

    ``lines`` is a list of objects exposing:
        start, end, text, key, hstart, hend
    where:
        - ``text`` is the full line text
        - ``key`` is the highlighted word for this line
        - ``hstart``/``hend`` are the active window of the highlight

    A separate Dialogue event is emitted per active word so the
    currently-spoken word animates while the rest of the line stays
    static and correctly positioned.

    When ``hook_text`` is provided a large top-of-screen banner is added
    for the opening ~1.5 seconds — the standard "hook" pattern used by
    high-performing Shorts/Reels.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    primary = _hex_to_ass(style.primary_color)
    highlight = _hex_to_ass(style.highlight_color)
    dimmed = _hex_to_ass(style.dimmed_color)
    outline = _hex_to_ass(style.outline_color)
    background = _hex_to_ass(style.background_color)

    font_style = "Default"
    play_res_y = height
    margin_v = style.margin_v

    # Vertical position: keep text away from overlays at the bottom
    if style.position == "center":
        pos_y = height // 2
        anchor = "\\an5"
    elif style.position == "lower":
        pos_y = height - margin_v + style.output_height()
        anchor = "\\an7"
    else:  # lower_center (safe default for 9:16 shorts)
        pos_y = height - margin_v - int(style.output_height() / 2)
        anchor = "\\an2"

    pos_x = width // 2

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        f"PlayResY: {play_res_y}\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, "
        "SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, "
        "Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: {font_style}, {style.font_name}, {style.font_size}, "
        f"{primary}, {highlight}, {outline}, {background}, "
        f"{'-1' if style.bold else '0'}, 0, 0, 0, 100, 100, 0, 0, 1, "
        f"{style.outline_width}, 1, 2, {style.safe_margin_x}, "
        f"{style.safe_margin_x}, {margin_v}, 1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, "
        "MarginV, Effect, Text\n"
    )

    events = []

    for line in lines:
        base_override = f"{anchor}\\pos({pos_x},{pos_y})"

        if style.animation == "word_highlight":
            events.append(
                _build_word_highlight_events(
                    lines,
                    style,
                    base_override,
                    primary,
                    highlight,
                    dimmed,
                )
            )
            break
        else:
            # Static single-event rendering (still keeps line timing).
            pop = ""
            if style.animation == "pop_in":
                pop = (
                    "\\fad(100,80)\\t(0,100,\\fscx110\\fscy110\\fscx100\\fscy100)"
                )

            events.append(
                _build_static_event(
                    line,
                    base_override + pop,
                    primary,
                )
            )

    flattened = [
        event
        for group in events
        for event in group
    ]

    if hook_text and flattened:
        flattened.append(
            _build_hook_event(
                flattened,
                style,
                hook_text,
                width,
                height,
            )
        )

    flattened.sort(key=lambda e: e.start)

    dialogue_lines = [
        (
            f"Dialogue: 0,{_format_ass_timestamp(e.start)},"
            f"{_format_ass_timestamp(e.end)},{font_style},,0,0,0,,"
            f"{{{e.override}}}{e.text}"
        )
        for e in flattened
    ]

    output_path.write_text(
        header + "\n".join(dialogue_lines) + "\n",
        encoding="utf-8",
    )

    return output_path


class _Event:
    __slots__ = ("start", "end", "override", "text")

    def __init__(self, start, end, override, text):
        self.start = start
        self.end = end
        self.override = override
        self.text = text


def _build_word_highlight_events(
    lines,
    style,
    base_override,
    primary,
    highlight,
    dimmed,
):
    """
    Emit karaoke pop events from the GLOBAL word stream (across all
    grouped lines) so caption windows are strictly non-overlapping —
    a word disappears exactly when its successor takes its place.

    Words that share the same start time (Whisper collapses some runs)
    are merged into a single pop so nothing is lost and no two pops
    ever draw on top of each other. If the timing never advances,
    fall back to one static caption per grouped chunk.
    """
    words = [
        line_word
        for line in lines
        for line_word in line.words
    ]

    if not words:
        return []

    advancing = any(
        words[i + 1].start >= words[i].start + 0.05
        for i in range(len(words) - 1)
    )

    if not advancing:
        return [
            _Event(
                start=line.start,
                end=line.end,
                override=base_override,
                text=_esc(" ".join(word.text for word in line.words)),
            )
            for line in lines
        ]

    global_start = lines[0].start
    global_end = lines[-1].end

    events = []
    index = 0
    count = len(words)

    while index < count:
        start = words[index].start
        parts = [words[index].text]

        merge_index = index + 1
        while (
            merge_index < count
            and words[merge_index].start < start + 0.05
        ):
            parts.append(words[merge_index].text)
            merge_index += 1

        end = (
            words[merge_index].start
            if merge_index < count
            else global_end
        )

        if end <= start + 0.001:
            end = min(global_end, start + 0.001)

        events.append(
            _Event(
                start=max(global_start, start),
                end=min(end, global_end),
                override=base_override,
                text=(
                    f"{{\\c{highlight}}}{_esc(' '.join(parts))}"
                    f"{{\\c{primary}}}"
                ),
            )
        )

        index = merge_index

    return events


def _build_static_event(
    line,
    override,
    primary,
):
    return [
        _Event(
            start=line.start,
            end=line.end,
            override=override,
            text=_esc(line.text),
        )
    ]


def _build_hook_event(
    events,
    style,
    hook_text,
    width,
    height,
):
    """
    Big top-of-screen hook banner shown for the opening ~1.5 seconds.

    The banner sits well above the lower-center captions so the two
    never overlap.
    """
    if not events:
        return None

    start = events[0].start
    end = events[-1].end

    # Keep it short and punchy; never blank out the captions that follow.
    end = min(start + 1.6, max(start + 0.6, end))

    if end <= start + 0.001:
        return None

    font_size = int(style.font_size * 1.35)
    pos_y = int(height * 0.14)

    override = (
        f"\\an8\\pos({width // 2},{pos_y})\\fs{font_size}"
        f"\\b1\\fad(170,150)\\fscx108\\fscy108"
    )

    return _Event(
        start=start,
        end=end,
        override=override,
        text=_esc(hook_text),
    )