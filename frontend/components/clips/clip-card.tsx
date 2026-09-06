"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Send,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Clip } from "@/lib/types";
import { resolvePreviewUrl, resolveVideoUrl } from "@/lib/data";
import { formatClipDuration, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ClipStatusBadge } from "@/components/ui/status-badge";

type PublishingHint = "published" | "failed" | "active" | null;

export function ClipCard({
  clip,
  selected,
  onSelect,
  publishingHint,
  showCheckbox = true,
  compact = false,
  onPublish,
}: {
  clip: Clip;
  selected: boolean;
  onSelect: () => void;
  publishingHint?: PublishingHint;
  showCheckbox?: boolean;
  compact?: boolean;
  onPublish?: () => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const source = clip.render_ready
    ? resolvePreviewUrl(clip)
    : resolveVideoUrl(clip);

  function startPreview() {
    setHover(true);
    // Slight delay so the element is mounted before play() is called.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        // Keep silent on hover so the browser allows autoplay; clicking
        // the card later flips sound on (click is a user activation).
        video.muted = true;
        video
          .play()
          .catch(() => setPreviewBroken(true));
      });
    });
  }

  function stopPreview() {
    setHover(false);
    setSoundOn(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
    }
  }

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const next = !soundOn;
    video.muted = !next;
    if (next) video.volume = 1;
    setSoundOn(next);
    if (video.paused) {
      video.play().catch(() => setPreviewBroken(true));
    }
  }

  return (
    <div
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-border/70 hover:shadow-lg hover:shadow-black/20",
      )}
    >
      {/* Preview */}
      <div className="relative aspect-[9/16] overflow-hidden bg-black">
        {clip.render_ready && !previewBroken ? (
          <video
            ref={videoRef}
            src={source}
            muted={!soundOn}
            loop
            playsInline
            preload="metadata"
            onClick={toggleSound}
            className="h-full w-full cursor-pointer object-cover transition-opacity duration-200"
          />
        ) : clip.status === "rendering" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <span className="text-xs font-medium text-muted-foreground">Rendering…</span>
          </div>
        ) : clip.status === "failed" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted">
            <CircleAlert className="size-6 text-destructive" aria-hidden />
            <span className="text-xs font-medium text-destructive">Render failed</span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground">Not rendered</span>
          </div>
        )}

        {/* Sound indicator / toggle */}
        {clip.render_ready && !previewBroken && (hover || soundOn) && (
          <button
            type="button"
            aria-label={soundOn ? "Mute" : "Play with sound"}
            onClick={(e) => {
              e.stopPropagation();
              toggleSound();
            }}
            className="pointer-events-auto absolute bottom-2 right-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
          >
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        )}

        {/* Hover play overlay */}
        {!hover && clip.render_ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform duration-150 group-hover:scale-105">
              <Play className="ml-0.5 size-5" fill="currentColor" />
            </span>
          </div>
        )}

        {/* Duration */}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {formatClipDuration(clip.duration)}
        </span>

        {/* Publishing hint */}
        {publishingHint && <PublishingPill hint={publishingHint} />}

        {/* Caption indicator */}
        <span
          title="Captions enabled"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white"
        >
          <Subtitles className="size-3.5" />
        </span>

        {/* Selection checkbox */}
        {showCheckbox && (
          <span className="absolute bottom-2 left-2 z-10">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              label={`Select clip ${clip.id}`}
              className="bg-black/40 border-white/40 backdrop-blur"
            />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="space-y-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">
            AI Score{" "}
            <span className={cn("text-primary", clip.score >= 0.85 && "text-success")}>
              {formatScore(clip.score)}
            </span>
          </span>
          <ClipStatusBadge status={clip.status} renderReady={clip.render_ready} />
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground">
          {clip.score >= 0.85
            ? "Strong opening hook"
            : clip.score >= 0.75
              ? "High retention segment"
              : "Solid supporting moment"}
        </p>

        {!compact && (
          <div className="flex items-center justify-between border-t border-border pt-2.5">
            <Link
              href={`/clips/${clip.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <Eye className="size-3.5" />
              Open
            </Link>
            <DropdownMenu
              trigger={
                <button
                  aria-label="Clip actions"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <MoreVertical className="size-4" />
                </button>
              }
              items={[
                {
                  label: "Edit",
                  icon: <Pencil className="size-4" />,
                  onSelect: () => router.push(`/clips/${clip.id}`),
                },
                {
                  label: "Preview",
                  icon: <Eye className="size-4" />,
                  onSelect: () => router.push(`/clips/${clip.id}`),
                },
                {
                  label: "Publish",
                  icon: <Send className="size-4" />,
                  onSelect: () => onPublish?.(),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PublishingPill({ hint }: { hint: Exclude<PublishingHint, null> }) {
  if (hint === "published") {
    return (
      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-success/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
        <Send className="size-3" />
        Published
      </span>
    );
  }
  if (hint === "failed") {
    return (
      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-destructive/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
        <CircleAlert className="size-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-info/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
      <Loader2 className="size-3 animate-spin" />
      Publishing
    </span>
  );
}