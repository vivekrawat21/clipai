"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, AlertCircle } from "lucide-react";
import { data } from "@/lib/data";
import { isYoutubeUrl } from "@/lib/url";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuickCreate() {
  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a YouTube link to get started.");
      return;
    }
    if (!isYoutubeUrl(trimmed)) {
      setError("That doesn't look like a valid YouTube link.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const video = await data.createVideo(trimmed);
      toast({
        title: "Video submitted",
        description: `Video #${video.id} has been queued for processing.`,
        variant: "success",
      });
      router.push(`/videos/${video.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast({ title: "Could not submit video", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/60 p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Sparkles className="size-5" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Quick Create
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Create clips from a YouTube video
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Paste a link below and let AI find your strongest moments.
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="relative flex-1">
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://youtube.com/watch?v=…"
              aria-label="YouTube video URL"
              autoFocus={false}
              className="h-12 pr-10 text-base"
            />
            <Wand2
              aria-hidden
              className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/50"
            />
          </div>
          <Button
            size="lg"
            type="submit"
            loading={submitting}
            className="h-12 px-7"
          >
            {submitting ? "Analyzing…" : "Generate Clips"}
          </Button>
        </form>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircle className="size-4" />
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          AI will identify the strongest moments, generate clips, add captions and prepare
          them for publishing.
        </p>
      </div>
    </div>
  );
}