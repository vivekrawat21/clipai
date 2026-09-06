/**
 * Mock data provider — used when NEXT_PUBLIC_USE_MOCK === "true".
 *
 * Implements the same interface as lib/api.ts so the UI works out of the
 * box against realistic sample data while being wired for the real API.
 *
 * Processing/publishing is simulated in-memory so polling shows real
 * progress transitions (pending → processing → completed, etc.).
 */
import type {
  Clip,
  ClipPublishMetadata,
  PublishQueuedResponse,
  PublishRequest,
  PublishingJob,
  PublishingStatus,
  SocialAccount,
  Video,
  VideoDetail,
  VideoStatus,
} from "@/lib/types";
import type { SubtitleStylePatch } from "@/lib/api";

// Mirrors backend/app/services/subtitle_style.SubtitleStyle defaults.
const DEFAULT_SUBTITLE_STYLE = {
  font_name: "Noto Sans",
  font_size: 90,
  primary_color: "#FFFFFF",
  highlight_color: "#FFD700",
  dimmed_color: "#AAAAAA",
  outline_color: "#000000",
  outline_width: 4.0,
  background_color: "#80000000",
  bold: true,
  position: "lower_center",
  animation: "word_highlight",
  words_per_line: 3,
  margin_v: 400,
  safe_margin_x: 60,
};

// Sample mp4s (hosted, vertical-friendly when letterboxed by player).
const SAMPLE_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
];

const REASONS = [
  "Strong hook + high semantic coherence",
  "Big emotional spike early on",
  "High retention around a key claim",
  "Controversial take with strong engagement potential",
  "Clear question answered mid-video",
  "Punchy stat worth repeating standalone",
  "Natural pause after a bold statement",
  "Peak energy moment in the segment",
];

interface VideoSeed {
  id: number;
  youtube_id: string;
  title: string;
  status: VideoStatus;
  minutesAgo: number;
}
const videoSeeds: VideoSeed[] = [
  {
    id: 1,
    youtube_id: "rQ6kZtB0oZo",
    title: "How I Built an AI That Writes Code",
    status: "completed",
    minutesAgo: 130,
  },
  {
    id: 2,
    youtube_id: "IJhdKqakXxk",
    title: "The Hidden Cost of Remote Work",
    status: "completed",
    minutesAgo: 26 * 60,
  },
  {
    id: 3,
    youtube_id: "dQw4w9WgXcQ",
    title: "I Tested 10 Viral Hooks for 30 Days",
    status: "processing",
    minutesAgo: 18,
  },
  {
    id: 4,
    youtube_id: "M7lc1UVf-VE",
    title: "Figma to Production: Full Roadmap",
    status: "pending",
    minutesAgo: 6,
  },
  {
    id: 5,
    youtube_id: "jNQXAC9IVRw",
    title: "Why You Should Quit Your Job in 2026",
    status: "failed",
    minutesAgo: 3 * 24 * 60,
  },
];

function iso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

let videoSeq = 0;

function makeVideos(): Video[] {
  return videoSeeds.map((v) => ({
    id: v.id,
    youtube_url: `https://www.youtube.com/watch?v=${v.youtube_id}`,
    youtube_id: v.youtube_id,
    title: v.title,
    status: v.status,
    thumbnail_url: `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`,
    created_at: iso(v.minutesAgo),
  }));
}

let clipSeq = 0;

function makeClips(): Clip[] {
  const clips: Clip[] = [];
  videoSeq = 0;

  const seedCounts: Record<number, number> = { 1: 10, 2: 8, 3: 5, 5: 2 };
  const seedStatuses: Record<number, Clip["status"][]> = {
    1: [
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendering",
      "rendering",
      "failed",
      "generated",
    ],
    2: [
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendered",
      "rendered",
    ],
    3: ["generated", "generated", "generated", "generated", "generated"],
    5: ["generated", "generated"],
  };

  for (const video of videoSeeds) {
    const count = seedCounts[video.id] ?? 6;
    const statuses = seedStatuses[video.id] ?? ["rendered", "rendered", "rendered"];
    for (let i = 0; i < count; i++) {
      const duration = Math.round(18 + ((i * 7) % 22));
      const start = 40 + i * 33 + ((i * 11) % 25);
      const status = statuses[i % statuses.length] ?? "rendered";
      const isRendered = status === "rendered" || (video.id === 2 && i % 2 === 0);
      clips.push({
        id: 100 + video.id * 10 + i,
        video_id: video.id,
        candidate_id: video.id * 1000 + i,
        start_time: start,
        end_time: start + duration,
        duration,
        score: 0.68 + ((i * 7) % 31) / 100,
        status,
        video_url: "/clips/-/video",
        preview_url: "/clips/-/preview",
        render_ready: isRendered,
        reason: REASONS[i % REASONS.length] + ` for video "${video.title}"`,
      });
    }
  }
  return clips;
}

function sampleSourceUrl(): string {
  const source = SAMPLE_VIDEOS[clipSeq % SAMPLE_VIDEOS.length];
  return source;
}

function makeAccounts(): SocialAccount[] {
  const created = iso(10 * 24 * 60);
  return [
    {
      id: 1,
      platform: "instagram",
      external_account_id: "1784140000123456",
      display_name: "@creatorx",
      token_expires_at: iso(-5 * 24 * 60),
      is_active: true,
      created_at: created,
      updated_at: created,
    },
    {
      id: 2,
      platform: "youtube",
      external_account_id: "UCabc123xyz",
      display_name: "Creator Channel",
      token_expires_at: iso(-9 * 24 * 60),
      is_active: true,
      created_at: created,
      updated_at: created,
    },
  ];
}

let publishes = 0;

function makePublishingJob(
  clipId: number,
  platform: "instagram" | "youtube",
  initial: PublishingStatus = "published",
) {
  publishes += 1;
  const clip = clips.find((c) => c.id === clipId);
  const published = initial === "published" || (clip ? clip.id % 3 !== 0 : true);
  const status: PublishingStatus =
    initial === "queued" ? "queued" : published ? "published" : "failed";
  return {
    id: 500 + publishes,
    clip_id: clipId,
    platform,
    status,
    progress: status === "published" ? 100 : status === "queued" ? 0 : 40,
    external_id:
      status === "published" ? `${platform}-media-${clipId}` : null,
    external_url:
      status === "published"
        ? platform === "instagram"
          ? `https://www.instagram.com/reel/${platform}-media-${clipId}/`
          : `https://www.youtube.com/watch?v=${platform}-media-${clipId}`
        : null,
    error:
      status === "failed"
        ? "Video file rejected: encoding not supported"
        : null,
    created_at: iso(20 * 60),
    started_at: status === "queued" ? null : iso(19 * 60),
    completed_at: status === "published" ? iso(18 * 60) : null,
  } as PublishingJob;
}

function makeJobs(): PublishingJob[] {
  const jobs: PublishingJob[] = [];
  for (const v of [1, 2]) {
    for (const c of clips.filter((c) => c.video_id === v).slice(0, 3)) {
      jobs.push(makePublishingJob(c.id, "instagram"));
      jobs.push(makePublishingJob(c.id, "youtube"));
    }
  }
  return jobs;
}

function extractYoutubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    const id = u.searchParams.get("v");
    if (id) return id;
    return u.pathname.split("/").pop() ?? "unknown";
  } catch {
    return "unknown";
  }
}

const videos: Video[] = makeVideos();
const clips: Clip[] = makeClips();
const accounts: SocialAccount[] = makeAccounts();
const jobs: PublishingJob[] = makeJobs();

// Simulated in-memory processing watermark.
let processingWatermark = 0;
const jobAges = new Map<number, number>();
const clipAges = new Map<number, number>();

function advanceProcessing() {
  processingWatermark += 1;

  for (const video of videos) {
    if (video.status === "pending") {
      if (processingWatermark > 1) video.status = "processing";
    } else if (video.status === "processing") {
      if (processingWatermark > 4) video.status = "completed";
      if (processingWatermark > 4) clipSeq += 0;
    }
  }

  for (const job of jobs) {
    if (job.status === "queued" || job.status === "uploading") {
      const age = (jobAges.get(job.id) ?? 0) + 1;
      jobAges.set(job.id, age);
      if (job.status === "queued" && age >= 1) {
        job.status = "uploading";
        job.progress = 35;
      } else if (job.status === "uploading" && age >= 3) {
        job.status = "published";
        job.progress = 100;
        job.external_id = `${job.platform}-media-${job.clip_id}`;
        job.external_url =
          job.platform === "instagram"
            ? `https://www.instagram.com/reel/${job.platform}-media-${job.clip_id}/`
            : `https://www.youtube.com/watch?v=${job.platform}-media-${job.clip_id}`;
        job.completed_at = iso(0);
      }
    }
  }

  // Simulate the render pipeline for clips.
  for (const clip of clips) {
    if (clip.status === "generated" || clip.status === "rendering") {
      const age = (clipAges.get(clip.id) ?? 0) + 1;
      clipAges.set(clip.id, age);
      if (clip.status === "generated" && age >= 3) {
        clip.status = "rendering";
      } else if (clip.status === "rendering" && age >= 7) {
        clip.status = "rendered";
        clip.render_ready = true;
      }
    }
  }
}

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Coverts a mock clip into one ready for the video workspace. */
function toDetail(video: Video): VideoDetail {
  const job = video.status === "completed" || video.status === "failed"
    ? { id: video.id * 100, status: video.status, progress: video.status === "completed" ? 100 : 0, error: video.status === "failed" ? "Transcript extraction failed" : null }
    : { id: video.id * 100, status: "processing", progress: 20, error: null };
  return { ...video, job: job as VideoDetail["job"] };
}

export const mockApi = {
  async createVideo(url: string): Promise<Video> {
    await delay(500);
    const id = 100 + videoSeq++;
    const youtube_id = extractYoutubeId(url);
    const video: Video = {
      id,
      youtube_url: url,
      youtube_id,
      title: youtube_id === "unknown" ? "Untitled video" : `Uploaded video · ${youtube_id}`,
      status: "pending",
    };
    videoSeq += 1;
    // Inject as the newest video so the polling flow has something to watch.
    videos.unshift(video);
    clips.unshift(
      ...Array.from({ length: 6 }, (_, i) => ({
        id: 900 + video.id * 10 + i,
        video_id: video.id,
        candidate_id: video.id * 1000 + i,
        start_time: 40 + i * 33,
        end_time: 60 + i * 33,
        duration: 20 + (i % 15),
        score: 0.7 + (i % 25) / 100,
        status: "generated" as const,
        video_url: "/clips/-/video",
        preview_url: "/clips/-/preview",
        render_ready: false,
      })),
    );
    return video;
  },

  async getVideos(): Promise<Video[]> {
    await delay(200);
    advanceProcessing();
    return [...videos];
  },

  async getVideo(videoId: number): Promise<VideoDetail> {
    await delay(200);
    advanceProcessing();
    const video = videos.find((v) => v.id === videoId);
    if (!video) throw Object.assign(new Error("Video not found"), { status: 404, detail: "Video not found" });
    return toDetail(video);
  },

  async getVideoClips(videoId: number): Promise<Clip[]> {
    await delay(250);
    advanceProcessing();
    return clips
      .filter((c) => c.video_id === videoId)
      .map((c) => ({ ...c, video_url: sampleSourceUrl(), preview_url: sampleSourceUrl() }));
  },

  async getClip(clipId: number): Promise<Clip> {
    await delay(150);
    advanceProcessing();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) throw Object.assign(new Error("Clip not found"), { status: 404, detail: "Clip not found" });
    return { ...clip, video_url: sampleSourceUrl(), preview_url: sampleSourceUrl() };
  },

  async getClipPublishMetadata(clipId: number): Promise<ClipPublishMetadata> {
    await delay(250);
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) throw Object.assign(new Error("Clip not found"), { status: 404, detail: "Clip not found" });
    const hashtags = ["clips", "shorts", "reels", "creator", "viral"];
    return {
      title: `This is everything you missed #${clipId}`,
      description: `The best 9:16 takeaway from this video.\n\nFollow for more clips like this.\n\n${hashtags.map((t) => `#${t}`).join(" ")}`,
      caption: `The best 9:16 takeaway from this video.\n\nFollow for more clips like this.\n\n${hashtags.map((t) => `#${t}`).join(" ")}`,
      hashtags,
      hook: `This is everything you missed`,
    };
  },

  async updateClipSubtitleStyle(clipId: number, patch: SubtitleStylePatch): Promise<Clip> {
    await delay(200);
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) throw Object.assign(new Error("Clip not found"), { status: 404, detail: "Clip not found" });
    clip.subtitle_style = { ...(clip.subtitle_style ?? DEFAULT_SUBTITLE_STYLE), ...patch };
    return { ...clip, video_url: sampleSourceUrl(), preview_url: sampleSourceUrl() };
  },

  async publishClips(payload: PublishRequest): Promise<PublishQueuedResponse> {
    await delay(700);
    const created: PublishingJob[] = [];
    for (const clipId of payload.clip_ids) {
      for (const platform of payload.platforms) {
        created.push(makePublishingJob(clipId, platform as "instagram" | "youtube", "queued"));
      }
    }
    jobs.push(...created);
    return { status: "queued", jobs: created };
  },

  async getPublishingJobs(clipId?: number): Promise<PublishingJob[]> {
    await delay(150);
    advanceProcessing();
    return clipId === undefined
      ? [...jobs].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      : jobs.filter((j) => j.clip_id === clipId);
  },

  async getSocialAccounts(): Promise<SocialAccount[]> {
    await delay(150);
    return [...accounts];
  },

  getAuthUrl(platform: "instagram" | "youtube"): string {
    return `https://mock.clipai.local/api/social/${platform}/auth-url?mock=1`;
  },
};