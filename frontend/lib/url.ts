/** URL validation helpers. */

export function isYoutubeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return (
      u.hostname === "youtube.com" ||
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtu.be" ||
      u.hostname.endsWith(".youtube.com")
    );
  } catch {
    return false;
  }
}

/** Alias with a friendlier name for form validation messages. */
export const maybeYoutubeUrl = isYoutubeUrl;