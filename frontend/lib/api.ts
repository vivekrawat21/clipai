/**
 * Real ClipAI backend API client.
 *
 * Base URL comes from NEXT_PUBLIC_API_URL (never hard-code hosts here).
 * Every function throws ApiError on failure so callers can render
 * polished error states.
 */
import type {
  Clip,
  ClipPublishMetadata,
  PublishQueuedResponse,
  PublishRequest,
  PublishingJob,
  SocialAccount,
  Video,
  VideoDetail,
} from "@/lib/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      /* not JSON — keep default message */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------
// Videos
// ---------------------------------

export async function createVideo(url: string): Promise<Video> {
  return request<Video>("/api/videos", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function getVideos(): Promise<Video[]> {
  return request<Video[]>("/api/videos");
}

export async function getVideo(videoId: number): Promise<VideoDetail> {
  return request<VideoDetail>(`/api/videos/${videoId}`);
}

// ---------------------------------
// Clips
// ---------------------------------

export async function getVideoClips(videoId: number): Promise<Clip[]> {
  return request<Clip[]>(`/clips/video/${videoId}`);
}

export async function getClip(clipId: number): Promise<Clip> {
  return request<Clip>(`/clips/${clipId}`);
}

export async function getClipPublishMetadata(
  clipId: number,
): Promise<ClipPublishMetadata> {
  return request<ClipPublishMetadata>(`/clips/${clipId}/metadata`);
}

export type SubtitleStylePatch = Partial<{
  font_size: number;
  primary_color: string;
  highlight_color: string;
  dimmed_color: string;
  outline_color: string;
  outline_width: number;
  words_per_line: number;
}>;

export async function updateClipSubtitleStyle(
  clipId: number,
  patch: SubtitleStylePatch,
): Promise<Clip> {
  return request<Clip>(`/clips/${clipId}/style`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getClipVideoUrl(clip: Pick<Clip, "id" | "video_url">): string {
  return API_BASE_URL + (clip.video_url ?? `/clips/${clip.id}/video`);
}

export function getClipPreviewUrl(clip: Pick<Clip, "id" | "preview_url">): string {
  return API_BASE_URL + (clip.preview_url ?? `/clips/${clip.id}/preview`);
}

// ---------------------------------
// Publishing
// ---------------------------------

export async function publishClips(
  payload: PublishRequest,
): Promise<PublishQueuedResponse> {
  return request<PublishQueuedResponse>("/api/publishing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPublishingJob(jobId: number): Promise<PublishingJob> {
  return request<PublishingJob>(`/api/publishing/${jobId}`);
}

export async function getPublishingJobs(
  clipId?: number,
): Promise<PublishingJob[]> {
  const query = clipId !== undefined ? `?clip_id=${clipId}` : "";
  return request<PublishingJob[]>(`/api/publishing${query}`);
}

// ---------------------------------
// Social accounts
// ---------------------------------

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  return request<SocialAccount[]>("/api/social/accounts");
}

export function getAuthUrl(platform: "instagram" | "youtube"): string {
  return `${API_BASE_URL}/api/social/${platform}/auth-url`;
}