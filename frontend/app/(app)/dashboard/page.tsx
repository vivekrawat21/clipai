"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  CircleCheck,
  Plus,
  Scissors,
  Send,
  Sparkles,
} from "lucide-react";
import type { Clip, Video } from "@/lib/types";
import { data } from "@/lib/data";
import { QuickCreate } from "@/components/dashboard/quick-create";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentVideos } from "@/components/dashboard/recent-videos";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { ClipCard } from "@/components/clips/clip-card";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [clipsByVideo, setClipsByVideo] = useState<Record<number, Clip[]>>({});
  const [publishedCount, setPublishedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const videosList = await data.getVideos();
        if (cancelled) return;
        setVideos(videosList);

        const recent = videosList.slice(-5);
        const counts: Record<number, Clip[]> = {};

        const [jobs] = await Promise.all([
          data.getPublishingJobs(),
          Promise.all(
            recent.map(async (video) => {
              try {
                counts[video.id] = await data.getVideoClips(video.id);
              } catch {
                counts[video.id] = [];
              }
            }),
          ),
        ]);

        if (cancelled) return;
        setClipsByVideo(counts);
        setPublishedCount(new Set(jobs.filter((j) => j.status === "published").map((j) => j.clip_id)).size);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load dashboard";
          setError(message);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const list = videos ?? [];
    const completed = list.filter((v) => v.status === "completed").length;
    const totalClips = Object.values(clipsByVideo).reduce((sum, c) => sum + c.length, 0);
    const allClips = Object.values(clipsByVideo).flat();
    const renderSuccess = allClips.filter((c) => c.render_ready).length;
    const successRate = allClips.length === 0 ? null : Math.round((renderSuccess / allClips.length) * 100);
    return { completed, totalClips, successRate };
  }, [videos, clipsByVideo]);

  const topClips = useMemo(
    () =>
      Object.values(clipsByVideo)
        .flat()
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    [clipsByVideo],
  );

  const clipCountFor = (videoId: number) => clipsByVideo[videoId]?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {greeting()} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Turn your latest videos into content that gets watched.
        </p>
      </header>

      <div className="space-y-8">
        <QuickCreate />

        {/* Stats */}
        <section aria-label="Processing overview">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Clapperboard className="size-5" />}
              label="Videos processed"
              value={stats.completed}
              accent="primary"
            />
            <StatCard
              icon={<Scissors className="size-5" />}
              label="Clips generated"
              value={stats.totalClips}
              accent="info"
            />
            <StatCard
              icon={<Send className="size-5" />}
              label="Published"
              value={publishedCount}
              accent="success"
            />
            <StatCard
              icon={<CircleCheck className="size-5" />}
              label="Success rate"
              value={stats.successRate === null ? "—" : `${stats.successRate}%`}
              accent="warning"
            />
          </div>
        </section>

        {/* Recent videos */}
        <section>
          <SectionTitle title="Recent Videos" linkHref="/videos" linkLabel="View all" />
          {videos === null && !error ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[84px] rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Couldn't load recent videos"
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card px-5 py-2">
              <RecentVideos videos={[...(videos ?? [])].reverse().slice(-4)} clipCounts={clipCountFor} />
            </div>
          )}
        </section>

        {/* Recent clips */}
        <section>
          <SectionTitle title="Recent Clips" linkHref="/clips" linkLabel="Clip library" />
          {topClips.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {topClips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} selected={false} onSelect={() => {}} showCheckbox={false} compact />
              ))}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/videos/new"
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            <Plus className="size-4" />
            Create New Clips
          </Link>
          <Link
            href="/clips"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "w-full",
            })}
          >
            Review Your Clips
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  linkHref,
  linkLabel,
}: {
  title: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Sparkles className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      <Link href={linkHref} className="text-sm font-medium text-primary hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}