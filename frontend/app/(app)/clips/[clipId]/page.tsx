"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Captions,
  Crop,
  Loader2,
  MonitorPlay,
  Palette,
  Rocket,
  RotateCcw,
  Wand2,
} from "lucide-react";
import type { Clip } from "@/lib/types";
import { data, resolvePreviewUrl, resolveVideoUrl } from "@/lib/data";
import { usePoll } from "@/lib/use-poll";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/editor/video-player";
import { PublishDialog } from "@/components/publishing/publish-dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

type Aspect = "9:16" | "1:1" | "16:9";

// Colors for the BURNED-IN karaoke captions (text + active-word highlight).
const BAKED_TEXT_COLORS = ["#ffffff", "#ffd60a", "#ff5d8f", "#48cae4", "#b388ff"];
const BAKED_HIGHLIGHT_COLORS = ["#ffd60a", "#00d7ff", "#ff5d8f", "#39ff14", "#ffffff"];

// Scale the baked caption size (designed for a 1080px-wide frame) down
// to the ~300px editor preview column while staying legible.
const PREVIEW_SCALE = 0.3;

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "9:16", label: "9:16" },
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
];

export default function ClipEditorPage({ params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = use(params);
  const id = Number(clipId);
  const { toast } = useToast();

  const [detail, setDetail] = useState<Clip | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderRequested, setRenderRequested] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  // Editor state (frontend-only until a save endpoint exists).
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(60);
  const [playhead, setPlayhead] = useState(0);

  const [captionsOn, setCaptionsOn] = useState(true);
  const [captionText, setCaptionText] = useState("This is where the caption lives");
  const [activeWord, setActiveWord] = useState(0);

  const [bakingStyle, setBakingStyle] = useState(false);

  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [zoom, setZoom] = useState(100);
  const [safeArea, setSafeArea] = useState(true);

  const playerRef = useRef<VideoPlayerHandle>(null);

  // Initial load.
  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    data
      .getClip(id)
      .then((clip) => {
        if (cancelled) return;
        setDetail(clip);
        setStart(clip.start_time);
        setEnd(clip.end_time);
        setLoadError(null);
        setRenderRequested(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Couldn't load this clip");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Poll while a render is requested.
  const renderPoll = usePoll<Clip | null>({
    enabled: renderRequested,
    interval: 2000,
    fetcher: async () => data.getClip(id),
    shouldStop: (clip) => clip === null || clip.render_ready || clip.status === "failed",
    onError: (err) => {
      setRenderRequested(false);
      toast({
        title: "Couldn't check render status",
        description: err instanceof Error ? err.message : "The backend may be offline.",
        variant: "error",
      });
    },
  });

  useEffect(() => {
    const polled = renderPoll.data;
    if (!polled) return;
    if (polled.render_ready) {
      toast({ title: "Preview ready", description: "Your rendered clip is ready to review.", variant: "success" });
    } else if (polled.status === "failed") {
      toast({ title: "Render failed", description: polled.status, variant: "error" });
    }
  }, [renderPoll.data, toast]);

  const pollClip = renderPoll.data && renderPoll.data.id === id ? renderPoll.data : null;
  const clip = pollClip ?? (detail?.id === id ? detail : null);

  function requestRender() {
    if (!clip || clip.render_ready) return;
    setRenderRequested(true);
    if (clip.status === "failed") renderPoll.refresh();
    toast({ title: "Rendering preview", description: "Burning captions and encoding…" });
  }

  // Demo the karaoke highlight on the preview strip: cycle which word
  // is highlighted, exactly like the burned-in captions behave.
  useEffect(() => {
    const words = captionText.trim().split(/\s+/);
    if (!captionsOn || words.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveWord((current) => {
        const next = current + 1;
        return next >= words.length ? 0 : next;
      });
    }, 800);
    return () => window.clearInterval(timer);
  }, [captionsOn, captionText]);

  // Bake a new burned-in caption style via the backend and re-render.
  async function changeBakedStyle(patch: Parameters<typeof data.updateClipSubtitleStyle>[1]) {
    if (!clip || bakingStyle) return;
    setBakingStyle(true);
    try {
      const updated = await data.updateClipSubtitleStyle(clip.id, patch);
      setDetail(updated);
      setRenderRequested(true);
      toast({ title: "Caption style saved", description: "Re-rendering the clip with the new look…" });
    } catch (err) {
      toast({
        title: "Couldn't update caption style",
        description: err instanceof Error ? err.message : "The backend may be offline.",
        variant: "error",
      });
    } finally {
      setBakingStyle(false);
    }
  }

  const bakedStyle = clip?.subtitle_style;

  const captionStyle = useMemo(() => {
    if (!bakedStyle) {
      return { fontSize: Math.round(90 * PREVIEW_SCALE), fontWeight: 800 };
    }
    return {
      fontSize: Math.round((bakedStyle.font_size ?? 90) * PREVIEW_SCALE),
      fontWeight: bakedStyle.bold ? 800 : 600,
    };
  }, [bakedStyle]);

  const rawDuration = clip?.duration ?? 60;
  const MIN_WINDOW = 3;

  function onStartChange(value: number) {
    setStart(value);
    if (end - value < MIN_WINDOW) setEnd(Math.min(rawDuration, value + MIN_WINDOW));
  }

  function onEndChange(value: number) {
    setEnd(value);
    if (value - start < MIN_WINDOW) setStart(Math.max(0, value - MIN_WINDOW));
  }

  const windowPct = rawDuration === 0 ? 0 : ((end - start) / rawDuration) * 100;

  const src = clip
    ? clip.render_ready
      ? resolvePreviewUrl(clip)
      : resolveVideoUrl(clip)
    : null;

  const rendering = renderRequested && !clip?.render_ready && clip?.status !== "failed";
  const renderLabel = clip?.render_ready ? "Rendered" : rendering ? "Rendering…" : "Render preview";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/clips"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to clips
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Clip Editor</h1>
            {clip && (
              <Badge variant={clip.render_ready ? "success" : "secondary"}>
                {clip.render_ready ? "Rendered" : "Draft"}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Clip #{id} · {rawDuration.toFixed(1)}s raw · trim the moment, style the captions, then render & publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={requestRender}
            disabled={!clip || rendering || clip.render_ready}
            loading={rendering}
          >
            {rendering ? <Loader2 className="size-4 animate-spin" /> : <MonitorPlay className="size-4" />}
            {renderLabel}
          </Button>
          <Button
            onClick={() => setPublishOpen(true)}
            disabled={!clip || !clip.render_ready}
          >
            <Rocket className="size-4" />
            Publish
          </Button>
        </div>
      </header>

      {loadError ? (
        <ErrorState
          title="Couldn't load this clip"
          description={loadError}
          action={
            <Link href="/clips" className={buttonVariants({ variant: "outline" })}>
              Back to clips
            </Link>
          }
        />
      ) : !clip ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="aspect-[9/16] w-full max-w-[320px] rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Preview column */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                className={cn(
                  "overflow-hidden rounded-2xl border border-border",
                  aspect === "9:16" && "w-full max-w-[300px]",
                  aspect === "1:1" && "w-full max-w-[340px]",
                  aspect === "16:9" && "w-full max-w-[640px]",
                )}
              >
                <div
                  className="transition-transform duration-200"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center bottom" }}
                >
                  <VideoPlayer
                    ref={playerRef}
                    src={src}
                    aspect={aspect}
                    autoPlay={false}
                    showSafeArea={safeArea}
                    loadingLabel={rendering ? "Rendering…" : "Loading…"}
                    onTimeUpdate={setPlayhead}
                  />
                </div>
                {/* Live karaoke caption preview */}
                {captionsOn && captionText.trim() && (
                  <div className="mt-3 px-4 py-3">
                    <p
                      className="text-center font-bold leading-snug transition-colors duration-200"
                      style={{
                        ...captionStyle,
                        color: bakedStyle?.primary_color ?? "#ffffff",
                        WebkitTextStroke: "2px #000",
                        textShadow: "0 3px 6px rgba(0,0,0,0.85)",
                      }}
                      aria-label="Karaoke caption preview"
                    >
                      {captionText
                        .trim()
                        .split(/\s+/)
                        .map((word, index) => (
                          <span
                            key={`${word}-${index}`}
                            className="whitespace-pre"
                            style={{
                              color:
                                index === activeWord
                                  ? (bakedStyle?.highlight_color ?? "#ffd60a")
                                  : (bakedStyle?.primary_color ?? "#ffffff"),
                            }}
                          >
                            {index > 0 ? " " : ""}
                            {word}
                          </span>
                        ))}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Scrubber */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Preview scrubber</span>
                <span className="tabular-nums">{formatTimestamp(playhead)}</span>
              </div>
              <Slider
                min={0}
                max={Math.max(rawDuration, 1)}
                step={0.1}
                value={playhead}
                onValueChange={(v) => {
                  setPlayhead(v);
                  playerRef.current?.seek(v);
                }}
                ariaLabel="Scrub preview"
              />
            </div>
          </div>

          {/* Controls column */}
          <div className="space-y-4">
            {/* Timeline */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Crop className="size-4 text-primary" aria-hidden />
                  Trim window
                </h2>
                <button
                  onClick={() => {
                    setStart(clip.start_time);
                    setEnd(clip.end_time);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Reset
                </button>
              </div>

              {/* Window visualization */}
              <div className="relative mb-4 h-2 w-full rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 rounded-full bg-primary"
                  style={{ left: `${(start / Math.max(rawDuration, 1)) * 100}%`, width: `${windowPct}%` }}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Start</span>
                    <span className="tabular-nums">{formatTimestamp(start)}</span>
                  </div>
                  <Slider
                    min={0}
                    max={Math.max(rawDuration, 1)}
                    step={0.1}
                    value={start}
                    onValueChange={onStartChange}
                    ariaLabel="Trim start"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>End</span>
                    <span className="tabular-nums">{formatTimestamp(end)}</span>
                  </div>
                  <Slider
                    min={0}
                    max={Math.max(rawDuration, 1)}
                    step={0.1}
                    value={end}
                    onValueChange={onEndChange}
                    ariaLabel="Trim end"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Kept length: <span className="font-medium tabular-nums">{formatTimestamp(end - start)}</span>
                </p>
              </div>
            </section>

            {/* Captions */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Captions className="size-4 text-primary" aria-hidden />
                  Captions
                </h2>
                <Switch checked={captionsOn} onCheckedChange={setCaptionsOn} label="Toggle captions" />
              </div>

              <div className="space-y-4">
                <Input
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Caption text…"
                  maxLength={160}
                  aria-label="Caption text"
                />
                <p className="text-xs text-muted-foreground">
                  Preview-only text. The burned-in captions come from the clip&apos;s transcript and are styled with the
                  colors below.
                </p>
              </div>
            </section>

            {/* Baked captions style */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Captions className="size-4 text-primary" aria-hidden />
                  Caption look (burned-in)
                </h2>
                {rendering && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>

              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Palette className="size-3.5" />
                    Text color
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {BAKED_TEXT_COLORS.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => changeBakedStyle({ primary_color: swatch })}
                        disabled={bakingStyle || rendering}
                        aria-label={`Baked caption text color ${swatch}`}
                        className={cn(
                          "size-7 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-50",
                          bakedStyle?.primary_color?.toUpperCase() === swatch.toUpperCase()
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Palette className="size-3.5" />
                    Active word highlight
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {BAKED_HIGHLIGHT_COLORS.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => changeBakedStyle({ highlight_color: swatch })}
                        disabled={bakingStyle || rendering}
                        aria-label={`Active word highlight color ${swatch}`}
                        className={cn(
                          "size-7 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-50",
                          bakedStyle?.highlight_color?.toUpperCase() === swatch.toUpperCase()
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Size</span>
                    <span className="tabular-nums">{bakedStyle?.font_size ?? 76}px</span>
                  </div>
                  <Slider
                    min={52}
                    max={110}
                    step={2}
                    value={bakedStyle?.font_size ?? 76}
                    onValueChange={(value) => changeBakedStyle({ font_size: value })}
                    ariaLabel="Baked caption font size"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  White caps with a black outline and a word-by-word bright highlight — matches Shorts karaoke
                  captions. Changes re-render the clip.
                </p>
              </div>
            </section>

            {/* Composition */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Wand2 className="size-4 text-primary" aria-hidden />
                Composition
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Aspect ratio</span>
                  <div className="flex items-center gap-1 rounded-lg border border-input p-0.5" role="group" aria-label="Aspect ratio">
                    {ASPECTS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAspect(a.id)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                          aspect === a.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Zoom</span>
                    <span className="tabular-nums">{zoom}%</span>
                  </div>
                  <Slider min={80} max={150} step={5} value={zoom} onValueChange={setZoom} ariaLabel="Zoom" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">UI safe area guides</span>
                  <Switch checked={safeArea} onCheckedChange={setSafeArea} label="Toggle safe area guides" />
                </div>
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> edits apply when the clip is next rendered.
              Render preview burns captions at the selected size, color and aspect.
            </p>
          </div>
        </div>
      )}

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        clips={clip ? [{ id: clip.id }] : []}
      />
    </div>
  );
}