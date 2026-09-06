import { Check, CircleAlert, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { VideoStatus } from "@/lib/types";

const STEPS = [
  { label: "Downloading video", detail: "Fetching the source video from YouTube" },
  { label: "Extracting transcript", detail: "Transcribing the audio track" },
  { label: "Analyzing moments", detail: "Scoring hooks, claims and emotional peaks" },
  { label: "Generating clips", detail: "Building highlight candidates" },
  { label: "Rendering subtitles", detail: "Burning captions into every clip" },
  { label: "Preparing previews", detail: "Encoding vertical previews" },
];

/**
 * Step-by-step processing progress for a video pipeline job.
 * Derives the active step from the job's status + progress percentage.
 */
export function VideoProcessing({
  status,
  progress = 0,
  error = null,
}: {
  status: VideoStatus;
  progress?: number;
  error?: string | null;
}) {
  const s = status.toLowerCase();
  const stepCount = STEPS.length;

  const activeIndex =
    s === "completed"
      ? stepCount
      : s === "failed"
        ? -1
        : s === "processing"
          ? Math.min(stepCount - 1, Math.floor((progress / 100) * stepCount))
          : 0;

  const percent =
    s === "completed" ? 100 : s === "failed" ? 0 : Math.max(5, Math.min(100, progress || 5));

  return (
    <div>
      {s === "failed" ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Processing failed</p>
            <p className="mt-0.5 text-destructive/90">
              {error ?? "Something went wrong while processing this video."}
            </p>
          </div>
        </div>
      ) : s === "completed" ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-success">
          <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">All done</p>
            <p className="mt-0.5 text-success/90">
              Your clips are rendered and ready for review.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {s === "completed" ? "Processing complete" : s === "failed" ? "Processing failed" : "Processing your video"}
          </span>
          <span className="tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
        </div>
        <Progress value={percent} label="Video processing progress" />
      </div>

      <ol className="space-y-1">
        {STEPS.map((step, index) => {
          const state =
            index < activeIndex || s === "completed"
              ? "done"
              : index === activeIndex && s !== "failed"
                ? "active"
                : "pending";
          return (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                state === "active" && "bg-muted/50",
                s === "failed" && "opacity-50",
              )}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  state === "done" && "border-success/50 bg-success/10 text-success",
                  state === "active" && "border-primary/40 bg-primary/10 text-primary",
                  state === "pending" && "border-border text-muted-foreground",
                )}
              >
                {state === "done" ? (
                  <Check className="size-3.5" aria-hidden />
                ) : state === "active" ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <CircleDashed className="size-3.5" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("font-medium", state === "pending" && "text-muted-foreground")}>
                  {step.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}