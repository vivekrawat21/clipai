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

    options = {
        "outtmpl": output_template,
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
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