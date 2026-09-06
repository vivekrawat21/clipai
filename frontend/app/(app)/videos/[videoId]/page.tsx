"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MessageSquareQuote, Sparkles } from "lucide-react";
import type { Clip, PublishingJob, VideoDetail } from "@/lib/types";
import { data, resolveVideoUrl } from "@/lib/data";
import { usePoll } from "@/lib/use-poll";
import { useToast } from "@/components/ui/toast";
import { VideoPlayer } from "@/components/editor/video-player";
import { ClipGrid } from "@/components/clips/clip-grid";
import { ClipCard } from "@/components/clips/clip-card";
import { VideoStatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { formatClipDuration, formatTimestamp } from "@/lib/format";

export default function VideoWorkspacePage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);
  const id = Number(videoId);

  const { toast } = useToast();

  const [clips, setClips] = useState<Clip[] | null>(null);
  const [jobs, setJobs] = useState<PublishingJob[]>([]);
  const [clipsError, setClipsError] = useState<string | null>(null);

  const poll = usePoll<VideoDetail | null>({
    enabled: Number.isFinite(id),
    interval: 3000,
    fetcher: async () => data.getVideo(id),
    shouldStop: (result) => result === null || result.status === "completed" || result.status === "failed",
  });

  // Keep the detailed job for live progress.
  const detail = poll.data;

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;

    async function load() {
      setClipsError(null);
      try {
        const [list, publishingJobs] = await Promise.all([
          data.getVideoClips(id),
          data.getPublishingJobs(),
        ]);
        if (cancelled) return;
        setClips(list);
        setJobs(publishingJobs);
      } catch (err) {
        if (!cancelled) {
          setClipsError(err instanceof Error ? err.message : "Failed to load clips");
          toast({ title: "Couldn't load clips", description: "Check that this video exists.", variant: "error" });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const sorted = useMemo(
    () => [...(clips ?? [])].sort((a, b) => b.score - a.score),
    [clips],
  );
  const topClip = sorted[0];

  const activeJobsOn = (clipId: number) =>
    jobs.filter((j) => j.clip_id === clipId && j.status !== "published" && j.status !== "failed");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/videos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to videos
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {detail?.title ?? `Video workspace`}
          </h1>
          {detail && <VideoStatusBadge status={detail.status} />}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {detail?.youtube_url ? (
            <a
              href={detail.youtube_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-primary"
            >
              Open source on YouTube
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            "Review your generated clips and jump into the editor."
          )}
        </p>
      </header>

      {poll.error ? (
        <ErrorState
          title="Couldn't load this video"
          description={poll.error instanceof Error ? poll.error.message : "Video not found"}
          action={
            <Link href="/videos">
              <Button variant="outline">Back to videos</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: player + analysis */}
          <div className="space-y-6 lg:col-span-1">
            <div className="overflow-hidden rounded-2xl border border-border bg-black">
              {topClip ? (
                <VideoPlayer src={resolveVideoUrl(topClip)} autoPlay={false} />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
                  <Skeleton className="size-full" />
                </div>
              )}
            </div>

            <AnalysisPanel clip={topClip} />

            {activeJobsOn(topClip?.id ?? -1).length > 0 && (
              <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Publishing in progress for this clip — status will refresh automatically.
              </p>
            )}
          </div>

          {/* Right: clip list */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Generated clips</h2>
              {clips && <span className="text-sm text-muted-foreground">{clips.length} candidates</span>}
            </div>

            {clips === null && !clipsError ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
                ))}
              </div>
            ) : clipsError ? (
              <ErrorState
                title="Couldn't load clips"
                description={clipsError}
                action={<Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>}
              />
            ) : (
              <ClipGrid
                clips={sorted}
                columns={4}
                renderCard={(clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    selected={false}
                    onSelect={() => {}}
                    showCheckbox={false}
                    publishingHint={
                      jobs.some((j) => j.clip_id === clip.id && j.status === "published")
                        ? "published"
                        : activeJobsOn(clip.id).length > 0
                          ? "active"
                          : jobs.some((j) => j.clip_id === clip.id && j.status === "failed")
                            ? "failed"
                            : null
                    }
                  />
                )}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({ clip }: { clip: Clip | undefined }) {
  if (!clip) return null;
  const percentile = Math.max(0, Math.min(100, Math.round(clip.score * 100)));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" aria-hidden />
        AI Analysis
      </h3>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Segment</dt>
          <dd className="font-medium tabular-nums">
            {formatTimestamp(clip.start_time)} – {formatTimestamp(clip.end_time)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Length</dt>
          <dd className="font-medium">{formatClipDuration(clip.duration)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Drive score</dt>
          <dd className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percentile}%` }}
              />
            </div>
            <span className="font-medium tabular-nums">{percentile}%</span>
          </dd>
        </div>
        {clip.reason && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3 text-muted-foreground">
            <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
            <p>{clip.reason}</p>
          </div>
        )}
      </dl>
    </div>
  );
}