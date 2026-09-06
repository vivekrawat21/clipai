import type { PublishingJob } from "@/lib/types";

export type PublishingHint = "published" | "failed" | "active" | null;

/**
 * Summarize the publishing state of a clip from its PublishingJobs.
 * Precedence: published > active > failed > null.
 */
export function clipPublishingHint(
  clipId: number,
  jobs: PublishingJob[],
): PublishingHint {
  if (!jobs || jobs.length === 0) return null;
  const related = jobs.filter((j) => j.clip_id === clipId);
  if (related.length === 0) return null;
  if (related.some((j) => j.status === "published")) return "published";
  if (related.some((j) => j.status !== "failed")) return "active";
  return "failed";
}

/** True when publishing is still running for a clip. */
export function isClipPublishing(clipId: number, jobs: PublishingJob[]): boolean {
  return jobs.some(
    (j) => j.clip_id === clipId && j.status !== "published" && j.status !== "failed",
  );
}