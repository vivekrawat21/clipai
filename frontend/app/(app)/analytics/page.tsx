"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clapperboard, Send, Sparkles } from "lucide-react";
import type { Clip, PublishingJob, Video } from "@/lib/types";
import { data } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [clipsByVideo, setClipsByVideo] = useState<Record<number, Clip[]>>({});
  const [jobs, setJobs] = useState<PublishingJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const videoList = await data.getVideos();
        const publishingJobs = await data.getPublishingJobs();
        const counts: Record<number, Clip[]> = {};
        await Promise.all(
          videoList.map(async (video) => {
            try {
              counts[video.id] = await data.getVideoClips(video.id);
            } catch {
              counts[video.id] = [];
            }
          }),
        );
        if (cancelled) return;
        setVideos(videoList);
        setClipsByVideo(counts);
        setJobs(publishingJobs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!videos || !jobs) return null;
    const allClips = Object.values(clipsByVideo).flat();
    const completed = videos.filter((v) => v.status === "completed").length;
    const publishedClips = new Set(jobs.filter((j) => j.status === "published").map((j) => j.clip_id)).size;
    const avgScore = allClips.length === 0 ? null : allClips.reduce((sum, c) => sum + c.score, 0) / allClips.length;
    return { completed, totalClips: allClips.length, publishedClips, avgScore };
  }, [videos, jobs, clipsByVideo]);

  const platformSplit = useMemo(() => {
    if (!jobs) return [];
    const counts: Record<string, number> = {};
    for (const j of jobs) if (j.status === "published") counts[j.platform] = (counts[j.platform] ?? 0) + 1;
    return [
      { platform: "instagram", count: counts.instagram ?? 0, label: "Instagram" },
      { platform: "youtube", count: counts.youtube ?? 0, label: "YouTube" },
    ];
  }, [jobs]);

  const perVideo = useMemo(() => {
    if (!videos) return [];
    return videos
      .map((v) => ({ video: v, clips: clipsByVideo[v.id] ?? [] }))
      .sort((a, b) => b.clips.length - a.clips.length);
  }, [videos, clipsByVideo]);

  const recentActivity = useMemo(() => {
    if (!jobs) return [];
    return [...jobs]
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 6);
  }, [jobs]);

  const totalClips = Math.max(1, Object.values(clipsByVideo).reduce((n, c) => n + c.length, 0));

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ErrorState
          title="Couldn't load analytics"
          description={error}
          action={<Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Analytics"
        description="A lightweight pulse on your content engine — every panel derives from your real data."
      />

      {!stats || !videos || !jobs ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overview */}
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Clapperboard className="size-5" />} label="Videos processed" value={stats.completed} accent="primary" />
            <StatCard icon={<BarChart3 className="size-5" />} label="Clips generated" value={stats.totalClips} accent="info" />
            <StatCard icon={<Send className="size-5" />} label="Clips published" value={stats.publishedClips} accent="success" />
            <StatCard
              icon={<Sparkles className="size-5" />}
              label="Avg drive score"
              value={stats.avgScore === null ? "—" : `${Math.round(stats.avgScore * 100)}%`}
              accent="warning"
            />
          </section>

          {/* Clips per video */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Clips generated per video</h2>
            <p className="mb-5 text-xs text-muted-foreground">Rendered candidates from your most recent sources.</p>
            <div className="space-y-4">
              {perVideo.slice(0, 8).map(({ video, clips }) => {
                const count = clips.length;
                const pct = Math.round((count / totalClips) * 100);
                return (
                  <div key={video.id} className="flex items-center gap-3">
                    <span className="w-40 truncate text-sm text-muted-foreground" title={video.title ?? ""}>
                      {video.title ?? `Video #${video.id}`}
                    </span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-primary/70 to-primary"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center pl-2 text-xs font-medium tabular-nums text-white/90">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
              {perVideo.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No videos yet.</p>
              )}
            </div>
          </section>

          {/* Platform split + activity */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Platform split</h2>
              <div className="space-y-4">
                {platformSplit.map(({ platform, count, label }) => {
                  const totalPublished = platformSplit.reduce((s, p) => s + p.count, 0);
                  const pct = totalPublished === 0 ? 0 : Math.round((count / totalPublished) * 100);
                  return (
                    <div key={platform}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize">{label}</span>
                        <span className="tabular-nums text-muted-foreground">{count} posts</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            platform === "instagram"
                              ? "bg-gradient-to-r from-pink-500 to-orange-400"
                              : "bg-gradient-to-r from-red-500 to-red-400",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Recent activity</h2>
              <ul className="space-y-3">
                {recentActivity.map((job) => (
                  <li key={job.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold uppercase",
                        job.status === "published"
                          ? "bg-success/10 text-success"
                          : job.status === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-info/10 text-info",
                      )}
                    >
                      {job.platform === "instagram" ? "IG" : "YT"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="truncate">Clip #{job.clip_id}</span>
                      <span className="ml-2 capitalize text-muted-foreground">{job.status}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(job.created_at)}
                    </span>
                  </li>
                ))}
                {recentActivity.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No publishing activity yet.</p>
                )}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}