"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Plus,
  Sparkles,
} from "lucide-react";
import { YoutubeIcon } from "@/components/ui/brand-icons";
import { data } from "@/lib/data";
import type { Video, VideoDetail } from "@/lib/types";
import { usePoll } from "@/lib/use-poll";
import { PageHeader } from "@/components/layout/page-header";
import { VideoProcessing } from "@/components/videos/video-processing";
import { VideoThumbnail } from "@/components/videos/video-thumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";
import { maybeYoutubeUrl } from "@/lib/url";

type Stage = "form" | "processing" | "done" | "failed";

export default function NewVideoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [created, setCreated] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [videoId, setVideoId] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll the processing job while it's running.
  const poll = usePoll<VideoDetail | null>({
    enabled: created && videoId !== null,
    interval: 2500,
    fetcher: async () => (videoId === null ? null : data.getVideo(videoId)),
    shouldStop: (result) => result === null || result.status === "completed" || result.status === "failed",
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Lost connection to the job";
      setError(message);
    },
  });

  const detail = poll.data ?? null;
  const detailStatus = detail?.status ?? null;
  const stage: Stage = !created
    ? "form"
    : detailStatus === "completed"
      ? "done"
      : detailStatus === "failed" || error
        ? "failed"
        : "processing";

  // Auto-advance once the job completes (side effect only — no state writes).
  const completedId = detailStatus === "completed" ? (detail?.id ?? null) : null;
  useEffect(() => {
    if (completedId === null) return;
    const t = setTimeout(() => router.push(`/videos/${completedId}`), 1800);
    return () => clearTimeout(t);
  }, [completedId, router]);

  async function handleCreate(goToWorkspace: boolean) {
    const trimmed = url.trim();
    if (!maybeYoutubeUrl(trimmed)) {
      toast({
        title: "That doesn't look like a YouTube link",
        description: "Paste a full YouTube or youtu.be URL to get started.",
        variant: "error",
      });
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await data.createVideo(trimmed);
      setVideo(created);
      setVideoId(created.id);
      setCreated(true);
      if (goToWorkspace) router.push(`/videos/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't start processing";
      setError(message);
      toast({ title: "Couldn't start processing", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCreated(false);
    setVideo(null);
    setVideoId(null);
    setUrl("");
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Create New Clips"
        description="Paste a YouTube link and ClipAI turns it into publish-ready short clips."
      />

      {stage === "form" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <label htmlFor="yt-url" className="mb-2 block text-sm font-medium">
            YouTube URL
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <YoutubeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="yt-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate(false);
                  }
                }}
                placeholder="https://youtube.com/watch?v=…"
                className="pl-9"
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="sm:w-auto"
              onClick={() => void navigator.clipboard?.readText().then((t) => t && setUrl(t))}
            >
              <ClipboardPaste className="size-4" />
              Paste
            </Button>
            <Button type="button" loading={submitting} onClick={() => void handleCreate(false)}>
              <Plus className="size-4" />
              Create
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            It usually takes 1–3 minutes. You can close this page — we&apos;ll keep working in the background.
          </p>
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {stage === "processing" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-6">
            <VideoThumbnail youtubeId={video?.youtube_id ?? "unknown"} alt="" className="aspect-video w-full rounded-xl" />
          </div>
          <VideoProcessing
            status={detail?.status ?? "pending"}
            progress={detail?.job?.progress ?? 5}
            error={detail?.job?.error}
          />
          <p className="mt-6 text-sm text-muted-foreground">
            You can keep working —{" "}
            <Link href={`/videos/${videoId}`} className="text-primary hover:underline">
              open this video
            </Link>{" "}
            or check back later.
          </p>
        </div>
      )}

      {stage === "done" && detail && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">Clips are ready!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.title ?? "Your video"} processed successfully. Taking you to the workspace…
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={`/videos/${detail.id}`}
              className={buttonVariants({ size: "lg" })}
            >
              Open workspace
              <ArrowRight className="size-4" />
            </Link>
            <Button variant="outline" size="lg" onClick={reset}>
              <Plus className="size-4" />
              Create another
            </Button>
          </div>
        </div>
      )}

      {stage === "failed" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          {video ? (
            <VideoProcessing status="failed" error={detail?.job?.error ?? error ?? undefined} />
          ) : (
            <ErrorState
              title="Couldn't start processing"
              description={error ?? "Something went wrong. Please try again."}
            />
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" size="lg" onClick={reset}>
              <Plus className="size-4" />
              Try another video
            </Button>
            {video && (
              <Link
                href={`/videos/${video.id}`}
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                View anyway
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Skeleton while the first poll response is loading */}
      {stage === "processing" && detail === null && (
        <div className="mt-6 animate-pulse space-y-2" aria-hidden>
          <Skeleton className="h-2 w-2/3 rounded-full" />
          <Skeleton className="h-4 rounded-full" />
          <Skeleton className="h-4 rounded-full" />
        </div>
      )}

      {stage === "form" && (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            ClipAI finds your video&apos;s strongest moments, scores each candidate for drive and retention, then renders
            vertical clips with baked-in captions — ready to publish to Instagram and YouTube.
          </p>
        </div>
      )}
    </div>
  );
}