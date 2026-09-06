"""
Video renderer service.

Builds final, polished short-form clips from raw generated clips.

The renderer is a pure FFmpeg wrapper:
    * it accepts explicit configuration objects (no global state)
    * it never talks to FastAPI or the database
    * it is independently testable

Render features:
    * optional subtitles burned in via ASS/SRT
    * vertical 9:16 output (crop/resize)
    * optional zoom / punch-in effect
    * optional subtle motion (ken-burns style)
    * audio preservation
    * H.264 video + AAC audio + faststart
"""
import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from app.services.media_probe import probe_stream_summary


logger = logging.getLogger(__name__)


@dataclass
class VideoEffectConfig:
    """
    Effects applied to the source clip during rendering.

    ``vertical_9_16`` — crop the source to 9:16 aspect ratio.
    ``zoom``          — continuous zoom-in strength (e.g. 0.0 = none,
                        0.1 = gentle punch-in). Applied as a scale.
    ``motion``        — subtle ken-burns style pan; one of:
                        "none", "push_in", "push_out", "pan_left", "pan_right"
    ``blur_background`` — when True and the video is wider than 9:16,
                        blurred bars fill the sides instead of cropping.
    ``vivid``          — apply a subtle saturation/contrast push so
                        palettes pop a little more on small screens.
    """
    vertical_9_16: bool = True
    width: int = 1080
    height: int = 1920
    zoom: float = 0.0
    motion: str = "none"
    blur_background: bool = False
    vivid: bool = False

    def __post_init__(self) -> None:
        if self.zoom < 0:
            raise ValueError("zoom cannot be negative")

        if self.motion not in {"none", "push_in", "push_out", "pan_left", "pan_right"}:
            raise ValueError(f"Unsupported motion: {self.motion}")


@dataclass
class RenderOptions:
    """
    Full configuration passed to a single render call.
    """
    output_path: Path
    subtitle_data: object | None = None
    subtitle_file: Path | None = None
    effects: VideoEffectConfig = field(
        default_factory=VideoEffectConfig,
    )
    audio_codec: str = "aac"
    video_codec: str = "libx264"
    crf: int = 23
    preset: str = "medium"


class VideoRenderer:
    """FFmpeg-backed renderer, stateless except for command building."""

    def render(
        self,
        source_path: Path,
        options: RenderOptions,
    ) -> Path:
        """
        Render ``source_path`` into ``options.output_path``.
        """
        if not source_path.exists():
            raise FileNotFoundError(
                f"Source clip not found: {source_path}"
            )

        options.output_path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        command = self._build_command(
            source_path,
            options,
        )

        logger.info(
            "Rendering final clip: source=%s output=%s",
            source_path,
            options.output_path,
        )

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            logger.error(
                "Render failed: %s",
                result.stderr[-4000:],
            )
            raise RuntimeError(
                f"FFmpeg render failed: {result.stderr[-4000:]}"
            )

        if not options.output_path.exists():
            raise RuntimeError(
                f"Render did not produce output: {options.output_path}"
            )

        output_summary = probe_stream_summary(options.output_path)

        input_summary = probe_stream_summary(source_path)

        if (
            input_summary["has_audio"]
            and not output_summary["has_audio"]
        ):
            raise RuntimeError(
                f"Rendered clip is missing audio: {options.output_path}"
            )

        logger.info(
            "Final clip rendered: %s",
            options.output_path,
        )

        return options.output_path

    def _probe_media(
        self,
        source_path: Path,
    ) -> tuple[float, float]:
        """
        Probe duration (seconds) and average frame rate (fps) with
        ffprobe. Returns (0.0, 0.0) when probing is unavailable so
        callers can fall back to static/centered effects.
        """

        command = [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "format=duration:stream=avg_frame_rate",
            "-of",
            "default=noprint_wrappers=1",
            str(source_path),
        ]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=60,
            )
        except (FileNotFoundError, subprocess.SubprocessError):
            logger.warning(
                "ffprobe not available; motion effects disabled"
            )
            return 0.0, 0.0

        if result.returncode != 0:
            return 0.0, 0.0

        duration = 0.0
        fps = 0.0

        for line in result.stdout.splitlines():
            if line.startswith("duration="):
                try:
                    duration = float(line.split("=", 1)[1])
                except ValueError:
                    duration = 0.0
            elif line.startswith("avg_frame_rate="):
                value = line.split("=", 1)[1].strip()
                try:
                    if "/" in value:
                        num, den = value.split("/", 1)
                        num, den = int(num), int(den)
                        fps = num / den if den else 0.0
                    else:
                        fps = float(value)
                except ValueError:
                    fps = 0.0

        return duration, fps

    # -----------------------------------------
    # Command construction (kept as pure methods
    # so they can be unit-tested without FFmpeg)
    # -----------------------------------------

    def _build_command(
        self,
        source_path: Path,
        options: RenderOptions,
    ) -> list[str]:
        effects = options.effects

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
        ]

        if effects.vertical_9_16:
            duration = None
            fps = None
            if effects.motion in {"pan_left", "pan_right", "push_in"}:
                duration, fps = self._probe_media(source_path)

            command += [
                "-vf",
                self._build_vf_filter(
                    effects,
                    options.subtitle_file,
                    duration=duration,
                    fps=fps,
                ),
            ]

        if options.subtitle_file and not effects.vertical_9_16:
            # Non-vertical rendering path (rare, kept for completeness).
            command += [
                "-vf",
                self._build_subtitle_only_filter(
                    options.subtitle_file
                ),
            ]

        command += [
            "-c:v",
            options.video_codec,
            "-crf",
            str(options.crf),
            "-preset",
            options.preset,
            "-c:a",
            options.audio_codec,
            "-movflags",
            "+faststart",
            str(options.output_path),
        ]

        return command

    def _build_subtitle_only_filter(
        self,
        subtitle_file: Path,
    ) -> str:
        escaped = self._escape_filter_path(subtitle_file)

        if subtitle_file.suffix.lower() == ".ass":
            return f"subtitles='{escaped}'"

        return f"subtitles='{escaped}'"

    def _build_vf_filter(
        self,
        effects: VideoEffectConfig,
        subtitle_file: Path | None,
        duration: float | None = None,
        fps: float | None = None,
    ) -> str:
        """
        Build the -vf filter graph.

        For 9:16 vertical output we either:
            * crop the center column (default, keeps full sharpness), or
            * pad blurred bars (blur_background) and scale-to-fit.

        A zoom/punch-in effect is layered on top as an animated scale.
        Subtitles are burned in with the fontconfig/ass filter.
        """
        w = effects.width
        h = effects.height

        filters = []

        if effects.blur_background:
            # Scale source to fill width and blur; then composite a clean
            # centered copy on top to create blurred side bars.
            filters.append(
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,"
                f"crop={w}:{h},boxblur=luma_radius=20:luma_power=1[bg]"
            )
            filters.append(
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease"
                f"[fg]"
            )
            filters.append(
                "[bg][fg]overlay=(W-w)/2:(H-h)/2[base]"
            )
            base = "[base]"
        else:
            # Center crop into 9:16 directly.
            filters.append(
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,"
                f"crop={w}:{h}[base]"
            )
            base = "[base]"

        # Zoom / punch-in as a continuous animated scale
        if effects.zoom > 0.0:
            zoom = 1.0 + effects.zoom
            filters.append(
                f"{base}scale=w='iw*{zoom}':h='ih*{zoom}'[zoomed]"
            )
            base = "[zoomed]"
        elif effects.motion != "none":
            base = self._apply_motion(
                filters,
                base,
                effects,
                w,
                h,
                duration or 0.0,
                fps=fps or 0.0,
            )

        # Final crop to exact canvas (post-effects), then subtitles
        filters.append(f"{base}crop={w}:{h}[out]")
        base = "[out]"

        if effects.vivid:
            filters.append(
                f"{base}eq=saturation=1.18:contrast=1.05:brightness=0.004[vivid]"
            )
            base = "[vivid]"

        if subtitle_file:
            esc = self._escape_filter_path(subtitle_file)
            if subtitle_file.suffix.lower() == ".ass":
                filters.append(f"{base}ass='{esc}':fontsdir=fonts[final]")
            else:
                filters.append(
                    f"{base}subtitles='{esc}':fontsdir=fonts[final]"
                )
            base = "[final]"

        return ";".join(filters)

    def _apply_motion(
        self,
        filters: list[str],
        base: str,
        effects: VideoEffectConfig,
        w: int,
        h: int,
        duration: float,
        fps: float | None = None,
    ) -> str:
        """
        Apply a subtle ken-burns style pan / push to the picture.
        """
        zoom = 1.08
        x_expr = "(W-w)/2"
        y_expr = "(H-h)/2"

        if effects.motion == "push_in":
            zoom = 1.12
            if duration > 0.0:
                # Animated push-in via zoompan: the crop window shrinks
                # from the full frame to 1/zoom over the clip, then is
                # resampled to the canvas for a punch-in sensation.
                # fps must match the input or A/V timing drifts.
                out_fps = fps if fps and fps > 0 else ""
                fps_arg = f":fps={out_fps}" if out_fps else ""
                z = f"1+0.12*min(1.0,time/{duration})"
                filters.append(
                    f"{base}zoompan=z='{z}':"
                    f"x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':"
                    f"d=1:s={w}x{h}{fps_arg}[motion]"
                )
                return "[motion]"
        elif effects.motion == "push_out":
            zoom = 1.20
            filters.append(
                f"{base}scale={w}:{h}:force_original_aspect_ratio=increase,"
                f"crop={w}:{h},scale=w='iw*{zoom}':h='ih*{zoom}',"
                f"crop=w={w}:h={h}:x={x_expr}:y={y_expr}[motion]"
            )
            return "[motion]"
        elif effects.motion in {"pan_left", "pan_right"}:
            if duration <= 0.0:
                # No duration info; fall back to a static center crop.
                filters.append(
                    f"{base}scale={w}:{h}:force_original_aspect_ratio=increase,"
                    f"crop={w}:{h}[motion]"
                )
                return "[motion]"

            if effects.motion == "pan_left":
                x_expr = f"(W-w)*(1-t/{duration})"
            else:
                x_expr = f"(W-w)*(t/{duration})"

        filters.append(
            f"{base}scale={w}:{h}:force_original_aspect_ratio=increase,"
            f"crop={w}:{h},scale=w='iw*{zoom}':h='ih*{zoom}',"
            f"crop=w={w}:h={h}:x={x_expr}:y={y_expr}[motion]"
        )

        return "[motion]"

    @staticmethod
    def _escape_filter_path(path: Path) -> str:
        value = str(path).replace("'", "'\\''")
        value = value.replace(":", "\\:")
        value = value.replace("[", "\\[")
        value = value.replace("]", "\\]")
        return value


video_renderer = VideoRenderer()


def render_final_clip(
    source_path: Path,
    options: RenderOptions,
) -> Path:
    """
    Convenience wrapper around the shared renderer instance.
    """
    return video_renderer.render(
        source_path,
        options,
    )