/**
 * Data access facade.
 *
 * Components import from here, never from api/mock directly, so swapping
 * mock data for the real backend is a single env flag:
 *   NEXT_PUBLIC_USE_MOCK === "true" → mock provider
 *   otherwise                       → real backend API
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
import * as realApi from "@/lib/api";
import type { SubtitleStylePatch } from "@/lib/api";
import { mockApi } from "@/lib/mock";

export interface DataProvider {
  createVideo(url: string): Promise<Video>;
  getVideos(): Promise<Video[]>;
  getVideo(videoId: number): Promise<VideoDetail>;
  getVideoClips(videoId: number): Promise<Clip[]>;
  getClip(clipId: number): Promise<Clip>;
  getClipPublishMetadata(clipId: number): Promise<ClipPublishMetadata>;
  updateClipSubtitleStyle(
    clipId: number,
    patch: SubtitleStylePatch,
  ): Promise<Clip>;
  publishClips(payload: PublishRequest): Promise<PublishQueuedResponse>;
  getPublishingJobs(clipId?: number): Promise<PublishingJob[]>;
  getSocialAccounts(): Promise<SocialAccount[]>;
  getAuthUrl(platform: "instagram" | "youtube"): string;
}

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const data: DataProvider = USE_MOCK ? mockApi : realApi;

/** Resolve the raw clip video URL for a <video> element. */
export function resolveVideoUrl(clip: Pick<Clip, "id" | "video_url">): string {
  if (USE_MOCK) return clip.video_url;
  return realApi.API_BASE_URL + clip.video_url;
}

/** Resolve the rendered preview URL for a <video> element. */
export function resolvePreviewUrl(
  clip: Pick<Clip, "id" | "preview_url">,
): string {
  if (USE_MOCK) return clip.preview_url;
  return realApi.API_BASE_URL + clip.preview_url;
}

export { USE_MOCK };
export { API_BASE_URL } from "@/lib/api";