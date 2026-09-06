"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Loader2, Rocket, Send, Wand2, X } from "lucide-react";
import type { Clip, ClipPublishMetadata, PublishQueuedResponse } from "@/lib/types";
import { data } from "@/lib/data";
import { Dialog, useDialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InstagramIcon, YoutubeIcon } from "@/components/ui/brand-icons";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const PLATFORMS = [
  {
    id: "instagram" as const,
    label: "Instagram",
    detail: "Reels · 9:16 · up to 90s",
    icon: <InstagramIcon className="size-8" />,
    accent: "from-pink-500/25 to-orange-400/25 text-pink-400",
  },
  {
    id: "youtube" as const,
    label: "YouTube",
    detail: "Shorts · 9:16 · up to 60s",
    icon: <YoutubeIcon className="size-8" />,
    accent: "from-red-500/25 to-red-400/20 text-red-400",
  },
] as const;

type Step = "platforms" | "details" | "done";

export function PublishDialog({
  open,
  onClose,
  clips,
  defaultTitle = "",
  defaultDescription = "",
}: {
  open: boolean;
  onClose: () => void;
  clips: Pick<Clip, "id">[];
  defaultTitle?: string;
  defaultDescription?: string;
}) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("platforms");
  const [platforms, setPlatforms] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishQueuedResponse | null>(null);

  const clipCount = clips.length;
  const firstClipId = clips[0]?.id;

  const fillFromMetadata = (meta: ClipPublishMetadata) => {
    setTitle(meta.title);
    setDescription(meta.description);
    setCaption(meta.caption);
    setHashtags(meta.hashtags);
  };

  async function generateMetadata() {
    if (!firstClipId || generating) return;
    setGenerating(true);
    try {
      const meta = await data.getClipPublishMetadata(firstClipId);
      fillFromMetadata(meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't generate copy";
      toast({ title: "Couldn't generate copy", description: message, variant: "error" });
    } finally {
      setGenerating(false);
    }
  }

  // Prefill untouched fields from the backend the first time the dialog
  // opens (or when the selected clip changes).
  useEffect(() => {
    if (!open || !firstClipId) return;
    let cancelled = false;
    data
      .getClipPublishMetadata(firstClipId)
      .then((meta) => {
        if (cancelled) return;
        setTitle((t) => t || meta.title);
        setDescription((d) => d || meta.description);
        setCaption((c) => c || meta.caption);
        setHashtags(meta.hashtags);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, firstClipId]);

  const togglePlatform = (platformId: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) next.delete(platformId);
      else next.add(platformId);
      return next;
    });
  };

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((t) => t !== tag));
    setCaption((prev) => prev.replace(new RegExp(`\\s*#${tag}`, "gi"), " ").replace(/\s+/g, " ").trim());
  };

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await data.publishClips({
        clip_ids: clips.map((c) => c.id),
        platforms: [...platforms],
        title: title.trim(),
        description: description.trim(),
        caption: caption.trim() || description.trim(),
      });
      setResult(response);
      setStep("done");
      toast({
        title: "Publishing started",
        description: `${response.jobs.length} job${response.jobs.length === 1 ? "" : "s"} queued across ${platforms.size} platform${platforms.size === 1 ? "" : "s"}.`,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while publishing";
      setError(message);
      toast({ title: "Publish failed", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(() => {
    if (!result) return null;
    return result.jobs.reduce<Record<string, number>>(
      (acc, job) => ({
        ...acc,
        [job.platform]: (acc[job.platform] ?? 0) + 1,
      }),
      {},
    );
  }, [result]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Publish clips"
      description={
        clipCount > 0
          ? `${clipCount} clip${clipCount === 1 ? "" : "s"} selected — pick where you want them to go.`
          : "Select clips first to publish them."
      }
    >
      <StepStepper step={step} />

      {step === "platforms" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const active = platforms.has(platform.id);
              return (
                <button
                  key={platform.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePlatform(platform.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
                      platform.accent,
                      !active && "opacity-60",
                    )}
                  >
                    {platform.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{platform.label}</span>
                    <span className="block text-xs text-muted-foreground">{platform.detail}</span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {active && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              {platforms.size === 0 ? "Choose at least one platform" : `${platforms.size} selected`}
            </span>
            <NextButton disabled={platforms.size === 0} onClick={() => setStep("details")} />
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <div>
            <label htmlFor="pub-title" className="mb-1.5 block text-sm font-medium">
              Title or caption
            </label>
            <div className="flex items-start gap-2">
              <Input
                id="pub-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. This AI trick saved me 10 hours"
                maxLength={100}
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void generateMetadata()}
                disabled={!firstClipId || generating}
                title="Generate from this clip's opening words"
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                <span className="hidden sm:inline">Generate</span>
              </Button>
            </div>
            <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
              {title.length}/100
            </p>
          </div>

          <div>
            <label htmlFor="pub-desc" className="mb-1.5 block text-sm font-medium">
              Description <span className="text-muted-foreground">(YouTube · optional)</span>
            </label>
            <Textarea
              id="pub-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add hashtags, links or a call to action…"
              rows={3}
              maxLength={2200}
            />
            <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
              {description.length}/2200
            </p>
          </div>

          {platforms.has("instagram") && (
            <div className="rounded-2xl border border-pink-500/30 bg-pink-500/5 p-3">
              <label htmlFor="pub-caption" className="mb-1.5 block text-sm font-medium">
                Instagram caption <span className="text-muted-foreground">(Reels)</span>
              </label>
              <Textarea
                id="pub-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption for your Reel — falls back to the description above."
                rows={3}
                maxLength={2200}
              />
              {hashtags.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-muted-foreground">Hashtags — click to remove</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeHashtag(tag)}
                        className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2.5 py-1 text-xs font-medium text-pink-400 transition-colors hover:bg-pink-500/25"
                      >
                        #{tag}
                        <X className="size-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                {caption.length}/2200
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {clipCount > 1 && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {clipCount} clips
              </span>
            )}
            {[...platforms].map((p) => (
              <span key={p} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                {p}
              </span>
            ))}
            <span
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
              title="Copy is auto-generated from this clip's opening words — always edit it before publishing."
            >
              <Wand2 className="size-3" />
              AI-assisted
            </span>
          </div>

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
              <CircleAlert className="size-4" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep("platforms")}>
              Back
            </Button>
            <Button
              loading={submitting}
              disabled={platforms.size === 0}
              onClick={() => void submit()}
            >
              <Rocket className="size-4" />
              {submitting ? "Publishing…" : `Publish ${clipCount} clip${clipCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-success/20 text-success">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <div>
              <p className="font-semibold text-success">Jobs queued</p>
              <p className="text-sm text-muted-foreground">
                {summary && (
                  <span className="capitalize">
                    {Object.entries(summary)
                      .map(([platform, count]) => `${count}× ${platform}`)
                      .join(" · ")}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <CloseButton variant="outline">Close</CloseButton>
            <Link href="/publishing">
              <Button className="w-full sm:w-auto">
                <Send className="size-4" />
                Track publishing
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function StepStepper({ step }: { step: Step }) {
  const steps = ["Platforms", "Details", "Done"];
  const index = step === "platforms" ? 0 : step === "details" ? 1 : 2;
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Publishing steps">
      {steps.map((label, i) => {
        const state = i < index ? "done" : i === index ? "active" : "pending";
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                state === "active" && "bg-primary/10 text-primary",
                state === "done" && "text-success",
                state === "pending" && "text-muted-foreground",
              )}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border text-[10px]",
                  state === "active" && "border-primary/40",
                  state === "done" && "border-success/50 text-success",
                )}
              >
                {state === "done" ? <Check className="size-2.5" /> : i + 1}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NextButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button disabled={disabled} onClick={onClick}>
      Continue
    </Button>
  );
}

function CloseButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  const close = useDialogClose();
  return (
    <Button variant={variant} onClick={close}>
      {children}
    </Button>
  );
}