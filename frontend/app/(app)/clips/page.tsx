"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  Eye,
  Grid3X3,
  List,
  Pencil,
  RefreshCw,
  Rocket,
  Scissors,
  Search,
  X,
} from "lucide-react";
import type { Clip, PublishingJob } from "@/lib/types";
import { data, resolvePreviewUrl } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { ClipGrid } from "@/components/clips/clip-grid";
import { ClipCard } from "@/components/clips/clip-card";
import { PublishDialog } from "@/components/publishing/publish-dialog";
import { ClipStatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatClipDuration, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "score" | "newest";
type StatusFilter = "all" | "ready" | "draft" | "rendering" | "failed";
type ViewMode = "grid" | "list";

interface RichClip {
  clip: Clip;
  videoTitle: string;
}

export default function ClipsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<RichClip[]>([]);
  const [jobs, setJobs] = useState<PublishingJob[]>([]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [view, setView] = useState<ViewMode>("grid");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [publishOpen, setPublishOpen] = useState(false);

  async function fetchAll(): Promise<{ jobs: PublishingJob[]; rich: RichClip[] }> {
    const [videos, publishingJobs] = await Promise.all([
      data.getVideos(),
      data.getPublishingJobs(),
    ]);
    const rich: RichClip[] = [];
    await Promise.all(
      videos.map(async (video) => {
        try {
          const videoClips = await data.getVideoClips(video.id);
          rich.push(...videoClips.map((clip) => ({ clip, videoTitle: video.title ?? `Video #${video.id}` })));
        } catch {
          /* skip videos we can't read */
        }
      }),
    );
    return { jobs: publishingJobs, rich };
  }

  function load() {
    void fetchAll()
      .then(({ jobs, rich }) => {
        setJobs(jobs);
        setClips(rich);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load clips");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = clips.filter(({ clip, videoTitle }) => {
      if (status === "ready" && !clip.render_ready) return false;
      if (status === "draft" && clip.status !== "generated") return false;
      if (status === "rendering" && clip.status !== "rendering") return false;
      if (status === "failed" && clip.status !== "failed") return false;
      if (!q) return true;
      return videoTitle.toLowerCase().includes(q) || String(clip.id).includes(q);
    });
    list = [...list].sort((a, b) =>
      sort === "score" ? b.clip.score - a.clip.score : b.clip.id - a.clip.id,
    );
    return list;
  }, [clips, query, status, sort]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(({ clip }) => selected.has(clip.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filtered.forEach(({ clip }) => next.delete(clip.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach(({ clip }) => next.add(clip.id));
      return next;
    });
  };

  const toggleOne = (clipId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const selectedClips = clips.filter(({ clip }) => selected.has(clip.id)).map(({ clip }) => clip);
  const hintFor = (clipId: number): ClipCardPublishingHint => {
    if (jobs.some((j) => j.clip_id === clipId && j.status === "published")) return "published";
    if (jobs.some((j) => j.clip_id === clipId && j.status !== "published" && j.status !== "failed")) return "active";
    if (jobs.some((j) => j.clip_id === clipId && j.status === "failed")) return "failed";
    return null;
  };

  const readyForPublish = selectedClips.filter((c) => c.render_ready).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Clip Library"
        description="Every generated clip. Review, edit, and publish your winners."
        actions={
          <Link href="/videos/new" className={buttonVariants()}>
            <Scissors className="size-4" />
            Generate Clips
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clips by source video…"
              className="pl-9"
              aria-label="Search clips"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-input p-0.5" role="group" aria-label="Filter by status">
              {(["all", "ready", "draft", "rendering", "failed"] as StatusFilter[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                    status === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-input p-0.5" role="group" aria-label="Sort clips">
              <button
                onClick={() => setSort(sort === "score" ? "newest" : "score")}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <ArrowUpDown className="size-3.5" />
                {sort === "score" ? "Best match" : "Newest"}
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-input p-0.5" role="group" aria-label="View mode">
              <button
                onClick={() => setView("grid")}
                aria-label="Grid view"
                className={cn("rounded-md p-1.5 transition-colors", view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                <Grid3X3 className="size-4" />
              </button>
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                className={cn("rounded-md p-1.5 transition-colors", view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                <List className="size-4" />
              </button>
            </div>

            <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Refresh clips">
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="sticky top-[104px] z-20 -mx-4 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-card px-4 py-3 shadow-lg shadow-black/20 sm:-mx-6 sm:px-6 lg:-mx-8 lg:sticky lg:px-8">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} label="Select all" indeterminate={!allVisibleSelected} />
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="size-3.5" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectedClips.length === 1 && router.push(`/clips/${selectedClips[0].id}`)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={readyForPublish === 0}
              title={readyForPublish === 0 ? "Select at least one rendered clip" : undefined}
            >
              <Rocket className="size-3.5" />
              Publish {readyForPublish > 0 ? `(${readyForPublish} ready)` : ""}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load your clips"
          description={error}
          action={<Button variant="outline" onClick={() => void load()}>Try again</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Scissors className="size-8" />}
          title="No clips found"
          description={
            clips.length === 0
              ? "Generate clips from a YouTube video to see them here."
              : "No clips match the current filters."
          }
        />
      ) : view === "grid" ? (
        <ClipGrid
          clips={filtered.map(({ clip }) => clip)}
          columns={5}
          renderCard={(clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              selected={selected.has(clip.id)}
              onSelect={() => toggleOne(clip.id)}
              publishingHint={hintFor(clip.id)}
              onPublish={() => {
                setSelected(new Set([clip.id]));
                setPublishOpen(true);
              }}
            />
          )}
        />
      ) : (
        <ListRows
          rows={filtered}
          selected={selected}
          onToggle={toggleOne}
          hintFor={hintFor}
        />
      )}

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        clips={selectedClips}
      />
    </div>
  );
}

type ClipCardPublishingHint = "published" | "failed" | "active" | null;

function ListRows({
  rows,
  selected,
  onToggle,
  hintFor,
}: {
  rows: { clip: Clip; videoTitle: string }[];
  selected: Set<number>;
  onToggle: (clipId: number) => void;
  hintFor: (clipId: number) => ClipCardPublishingHint;
}) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map(({ clip, videoTitle }) => {
        const selectedNow = selected.has(clip.id);
        return (
          <li
            key={clip.id}
            className={cn(
              "flex items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40",
              selectedNow && "bg-primary/5",
            )}
          >
            <Checkbox checked={selectedNow} onCheckedChange={() => onToggle(clip.id)} label={`Select clip ${clip.id}`} />
            <MiniPreview clip={clip} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/clips/${clip.id}`} className="truncate text-sm font-semibold hover:text-primary">
                  {videoTitle}
                </Link>
                <ClipStatusBadge status={clip.status} renderReady={clip.render_ready} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>Clip #{clip.id}</span>
                <span>{formatClipDuration(clip.duration)}</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <ArrowUpDown className="size-3" />
                  {formatScore(clip.score)}
                </span>
                {hintFor(clip.id) === "published" && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Check className="size-3" />
                    Published
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/clips/${clip.id}`}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "shrink-0" })}
            >
              <Eye className="size-3.5" />
              Open
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MiniPreview({ clip }: { clip: Clip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <div className="relative h-16 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
      <video
        ref={videoRef}
        src={clip.render_ready ? resolvePreviewUrl(clip) : undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={() => videoRef.current?.play().catch(() => {})}
        onMouseLeave={() => videoRef.current?.pause()}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}