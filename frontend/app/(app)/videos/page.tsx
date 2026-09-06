"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, RefreshCw, Scissors, Search } from "lucide-react";
import type { Video } from "@/lib/types";
import { data } from "@/lib/data";
import { VideoThumbnail } from "@/components/videos/video-thumbnail";
import { VideoStatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [clipCounts, setClipCounts] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function fetchVideos(): Promise<{ videos: Video[]; counts: Record<number, number> }> {
    const list = await data.getVideos();
    const clipped = [...list].reverse();
    const counts: Record<number, number> = {};
    await Promise.all(
      list.map(async (video) => {
        try {
          counts[video.id] = (await data.getVideoClips(video.id)).length;
        } catch {
          counts[video.id] = 0;
        }
      }),
    );
    return { videos: clipped, counts };
  }

  function load() {
    void fetchVideos()
      .then(({ videos, counts }) => {
        setVideos(videos);
        setClipCounts(counts);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load videos");
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!videos) return [];
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!q) return true;
      return (v.title ?? `Video #${v.id}`).toLowerCase().includes(q);
    });
  }, [videos, query, statusFilter]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Videos"
        description="Every source video you've processed, with one-click access to its clips."
        actions={
          <Link href="/videos/new" className={buttonVariants()}>
            <Plus className="size-4" />
            New Video
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your videos…"
            className="pl-9"
            aria-label="Search videos"
          />
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Filter by status">
          {["all", "completed", "processing", "pending", "failed"].map((value) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {value}
            </button>
          ))}
          <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Refresh videos">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {videos === null && !error ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load videos"
          description={error}
          action={<Button variant="outline" onClick={() => void load()}>Try again</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="No videos found"
          description={
            query || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Paste a YouTube link to create your first clips."
          }
          action={
            query || statusFilter !== "all" ? undefined : (
              <Link href="/videos/new" className={buttonVariants()}>
                <Plus className="size-4" />
                New Video
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {filtered.map((video) => {
              const clips = clipCounts[video.id] ?? 0;
              const isProcessing = video.status === "processing" || video.status === "pending";
              return (
                <li key={video.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40">
                  <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-xl bg-muted">
                    <VideoThumbnail youtubeId={video.youtube_id} alt="" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/videos/${video.id}`}
                        className="truncate text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {video.title ?? `Video #${video.id}`}
                      </Link>
                      <VideoStatusBadge status={video.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Scissors className="size-3" aria-hidden />
                        {clips} clips
                      </span>
                      <span>{formatDate(video.created_at)}</span>
                      {isProcessing && <span className="text-warning">in progress…</span>}
                    </div>
                  </div>

                  <Link
                    href={`/videos/${video.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {isProcessing ? "View progress" : "Open"}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}