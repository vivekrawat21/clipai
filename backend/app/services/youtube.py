from urllib.parse import parse_qs, urlparse


def extract_youtube_id(url: str) -> str:
    parsed = urlparse(url)

    if parsed.hostname == "youtu.be":
        return parsed.path.lstrip("/")

    if parsed.hostname in {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
    }:
        query = parse_qs(parsed.query)

        if "v" in query:
            return query["v"][0]

    raise ValueError("Invalid YouTube URL")