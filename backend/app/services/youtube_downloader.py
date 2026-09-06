import os
from pathlib import Path

import yt_dlp


def download_video(
    youtube_url: str,
    output_dir: Path,
) -> Path:

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_template = str(
        output_dir / "source.%(ext)s"
    )

    yt_dlp_format = os.environ.get(
        "YT_DLP_FORMAT",
        # Cap source resolution at 1080p: the pipeline only ever outputs
        # 720p-wide clips, and decoding a 4K/AV1 source on a small box was
        # the main cause of ffmpeg OOM kills during clip generation.
        # Prefer H.264-in-mp4 (cheap to decode), fall back to best/mp4.
        (
            "bestvideo[ext=mp4][height<=1080]"
            "+bestaudio[ext=m4a]/"
            "best[ext=mp4]/best"
        ),
    )

    options = {
        "outtmpl": output_template,
        "format": yt_dlp_format,
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([youtube_url])

    video_path = output_dir / "source.mp4"

    if not video_path.exists():
        raise FileNotFoundError(
            f"Downloaded video not found: {video_path}"
        )

    return video_path