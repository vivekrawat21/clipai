/**
 * Shared domain types — mirrors the ClipAI backend schemas.
 *
 * Keep these aligned with:
 *   backend/app/schemas/{video,clip,social,publishing}.py
 */

export type VideoStatus = "pending" | "processing" | "completed" | "failed";

export interface Video {
  id: number;
  youtube_url: string;
  youtube_id: string;
  status: VideoStatus;
  title?: string;
  thumbnail_url?: string;
  created_at?: string;
}

export interface ProcessingJob {
  id: number;
  status: VideoStatus;
  progress: number;
  error: string | null;
}

export interface VideoDetail extends Video {
  job: ProcessingJob | null;
}

export type ClipStatus =
  | "generated"
  | "rendering"
  | "rendered"
  | "failed";

export interface Clip {
  id: number;
  video_id: number;
  candidate_id: number;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  status: ClipStatus;
  video_url: string;
  preview_url: string;
  render_ready: boolean;
  /** Flattened burned-in subtitle style (from the backend). */
  subtitle_style?: SubtitleStyle;
  /** Why this segment was picked — available from mock data only. */
  reason?: string;
}

export interface SubtitleStyle {
  font_name: string;
  font_size: number;
  primary_color: string;
  highlight_color: string;
  dimmed_color: string;
  outline_color: string;
  outline_width: number;
  background_color: string;
  bold: boolean;
  position: string;
  animation: string;
  words_per_line: number;
  margin_v: number;
  safe_margin_x: number;
}

export interface ClipCandidate {
  id: number;
  video_id: number;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  reason: string;
  semantic_score?: number;
  hooks?: string[];
  questions?: string[];
}

export type PublishingStatus =
  | "queued"
  | "uploading"
  | "publishing"
  | "published"
  | "failed";

export interface PublishingJob {
  id: number;
  clip_id: number;
  platform: "instagram" | "youtube";
  status: PublishingStatus;
  progress: number;
  external_id: string | null;
  external_url: string | null;
  error: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface SocialAccount {
  id: number;
  platform: "instagram" | "youtube";
  external_account_id: string | null;
  display_name: string | null;
  token_expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PublishRequest {
  clip_ids: number[];
  platforms: string[];
  title: string;
  description: string;
  caption?: string;
}

export interface PublishQueuedResponse {
  status: string;
  jobs: PublishingJob[];
}

/** Auto-generated publish copy for a clip (see ClipPublishMetadataResponse). */
export interface ClipPublishMetadata {
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  hook: string;
}

export interface ApiError {
  status: number;
  detail: string;
}