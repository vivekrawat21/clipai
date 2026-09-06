"""
Subtitle style abstraction.

Controls how subtitles are rendered by the video renderer and how
subtitle files (ASS/SRT) are generated.

All values are treated as configuration — the renderer itself decides
how to apply them. Nothing here is coupled to FFmpeg or FastAPI.
"""
from dataclasses import dataclass, field, replace


# ASS color conversion helper lives in subtitle_format; the style keeps
# human-readable hex strings so it can be stored/configured freely.


@dataclass
class SubtitleStyle:
    """
    Immutable-at-runtime style configuration for generated subtitles.

    ``position`` supports:
        "lower_center" — safe margin above the bottom (default)
        "center"       — vertically centered
        "lower"        — near the bottom edge

    ``animation`` supports:
        "word_highlight" — the currently spoken word is highlighted
        "none"           — static lines, no per-word animation
        "pop_in"         — line fades/scale in when it appears
    """

    font_name: str = "Noto Sans"
    font_size: int = 90
    primary_color: str = "#FFFFFF"
    highlight_color: str = "#FFD700"
    dimmed_color: str = "#AAAAAA"
    outline_color: str = "#000000"
    outline_width: float = 4.0
    background_color: str = "#80000000"
    bold: bool = True
    position: str = "lower_center"
    animation: str = "word_highlight"
    words_per_line: int = 3
    margin_v: int = 400
    safe_margin_x: int = 60

    def __post_init__(self) -> None:
        if self.position not in {"lower_center", "center", "lower"}:
            raise ValueError(
                f"Unsupported subtitle position: {self.position}"
            )

        if self.animation not in {"word_highlight", "none", "pop_in"}:
            raise ValueError(
                f"Unsupported subtitle animation: {self.animation}"
            )

    def output_height(self) -> int:
        """
        Estimated rendered height for a subtitle line, used to
        compute clearances / safe margins.
        """
        return int(self.font_size * 1.4)

    @classmethod
    def default(cls) -> "SubtitleStyle":
        return cls()

    @classmethod
    def from_dict(cls, data: dict) -> "SubtitleStyle":
        """
        Build a style from per-clip/user overrides (JSON submitted to
        the API). Missing keys fall back to the hard defaults; unknown
        keys are ignored.
        """
        allowed = {f.name for f in cls.__dataclass_fields__.values()}  # noqa: SLF001
        merged = {
            key: value
            for key, value in (data or {}).items()
            if key in allowed
        }
        return replace(cls.default(), **merged)