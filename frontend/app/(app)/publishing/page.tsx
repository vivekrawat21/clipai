"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Send,
} from "lucide-react";
import type { PublishingJob, SocialAccount } from "@/lib/types";
import { data } from "@/lib/data";
import { usePoll } from "@/lib/use-poll";
import { PageHeader } from "@/components/layout/page-header";
import { PublishingStatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { InstagramIcon, YoutubeIcon } from "@/components/ui/brand-icons";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "published" | "failed";

const ACTIVE = ["queued", "uploading", "publishing"];

function hasActiveJobs(jobs: PublishingJob[]): boolean {
  return jobs.some((j) => ACTIVE.includes(j.status));
}

export default function PublishingPage() {
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const poll = usePoll<PublishingJob[] | null>({
    interval: 2500,
    fetcher: async () => data.getPublishingJobs(),
    shouldStop: (jobs) => jobs === null || !hasActiveJobs(jobs),
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to load publishing status"),
  });

  const jobs = useMemo(() => poll.data ?? [], [poll.data]);

  useEffect(() => {
    data
      .getSocialAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const filtered = useMemo(() => {
    const list = [...jobs];
    if (filter === "active") return list.filter((j) => ACTIVE.includes(j.status));
    if (filter === "published") return list.filter((j) => j.status === "published");
    if (filter === "failed") return list.filter((j) => j.status === "failed");
    return list;
  }, [jobs, filter]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      active: jobs.filter((j) => ACTIVE.includes(j.status)).length,
      published: jobs.filter((j) => j.status === "published").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    }),
    [jobs],
  );

  const accountFor = (platform: "instagram" | "youtube") =>
    accounts?.find((a) => a.platform === platform && a.is_active);

  const loading = accounts === null && poll.data === null && !error;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Publishing"
        description="Connect your social accounts and track every clip you've shipped."
        actions={
          <Button variant="outline" onClick={() => poll.refresh()} disabled={!hasActiveJobs(jobs)}>
            <RefreshCw className={cn("size-4", hasActiveJobs(jobs) && "animate-spin")} />
            {hasActiveJobs(jobs) ? "Live" : "Refresh"}
          </Button>
        }
      />

      {/* Connected platforms */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Channels</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlatformCard
            platform="instagram"
            label="Instagram"
            detail="Reels · posts to a connected Instagram account"
            icon={<InstagramIcon className="size-7" />}
            account={accountFor("instagram")}
            connected={Boolean(accountFor("instagram"))}
          />
          <PlatformCard
            platform="youtube"
            label="YouTube"
            detail="Shorts · uploads to a connected YouTube channel"
            icon={<YoutubeIcon className="size-7" />}
            account={accountFor("youtube")}
            connected={Boolean(accountFor("youtube"))}
          />
        </div>
      </section>

      <RequirementsCard />

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All jobs"],
            ["active", "Active"],
            ["published", "Published"],
            ["failed", "Failed"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
            <span className={cn("ml-1.5 tabular-nums", filter === value ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
              {counts[value]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load publishing status"
          description={error}
          action={<Button variant="outline" onClick={() => poll.refresh()}>Try again</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Send className="size-8" />}
          title="Nothing here yet"
          description={
            filter === "all"
              ? "Publish a clip and its jobs will show up here."
              : `No ${filter} publishing jobs right now.`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {filtered.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  platform,
  label,
  detail,
  icon,
  account,
  connected,
}: {
  platform: "instagram" | "youtube";
  label: string;
  detail: string;
  icon: React.ReactNode;
  account: SocialAccount | undefined;
  connected: boolean;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br",
            platform === "instagram"
              ? "from-pink-500/25 to-orange-400/25 text-pink-400"
              : "from-red-500/25 to-red-400/20 text-red-400",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{label}</h3>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Plug className="size-3.5" />
            Not connected
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        {connected && account ? (
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium">{account.display_name ?? `Connected ${platform} account`}</span>
            <a
              href={data.getAuthUrl(platform)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Reconnect
              <ExternalLink className="size-3" />
            </a>
          </div>
        ) : (
          <a
            href={data.getAuthUrl(platform)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plug className="size-4" />
            Connect {label}
          </a>
        )}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: PublishingJob }) {
  const active = ACTIVE.includes(job.status);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            job.platform === "instagram"
              ? "text-pink-400"
              : "text-red-400",
          )}
        >
          {job.platform === "instagram" ? <InstagramIcon className="size-6" /> : <YoutubeIcon className="size-6" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clips/${job.clip_id}`}
              className="truncate text-sm font-semibold hover:text-primary"
            >
              Clip #{job.clip_id}
            </Link>
            <span className="text-xs text-muted-foreground capitalize">{job.platform}</span>
            <PublishingStatusBadge status={job.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{job.progress}%</span>
            <span>Started {formatRelativeTime(job.started_at)}</span>
            {job.completed_at && <span className="text-success">Completed {formatRelativeTime(job.completed_at)}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:w-52">
        {active ? (
          <div className="flex w-full items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            <Progress value={job.progress} label={`Publishing progress for job ${job.id}`} />
          </div>
        ) : job.status === "failed" ? (
          <p className="truncate text-xs text-destructive" title={job.error ?? undefined}>
            <CircleAlert className="mr-1 inline size-3.5" />
            {job.error ?? "Publish failed"}
          </p>
        ) : job.external_url ? (
          <a
            href={job.external_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View post
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

const REQUIREMENTS: { platform: "instagram" | "youtube"; points: string[] }[] = [
  {
    platform: "instagram",
    points: [
      "Your Instagram account must be a professional (Business/Creator) account, linked to a Facebook Page.",
      "Enable Instagram API access for a Meta app (Instagram Login for Business) and set INSTAGRAM_CLIENT_ID / SECRET.",
      "The clip is uploaded by URL, so it must be reachable at a public HTTPS address — not localhost.",
      "Clips must be 9:16 and between 5–90 seconds; posting may require the app to pass Meta app review.",
    ],
  },
  {
    platform: "youtube",
    points: [
      "Create an OAuth 2.0 Client ID using the Google Cloud Console (YouTube Data API v3) and set YOUTUBE_CLIENT_ID / SECRET.",
      "Enable the YouTube Data API v3, add the video upload scope, and have a YouTube channel the account can upload to.",
      "YouTube uploads happen server-to-server via the Data API — no public video URL is required.",
      "Pending changes to your OAuth consent screen must be verified/adjusted; public uploads may need app review.",
    ],
  },
];

function RequirementsCard() {
  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">How publishing works</h3>
        <span className="text-xs text-muted-foreground">
          Connect once in each channel card, then publish clips in one click.
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {REQUIREMENTS.map(({ platform, points }) => (
          <div key={platform} className="rounded-xl bg-muted/40 p-4">
            <div className="mb-2 flex items-center gap-2">
              {platform === "instagram" ? (
                <InstagramIcon className="size-4 text-pink-400" />
              ) : (
                <YoutubeIcon className="size-4 text-red-400" />
              )}
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {platform === "instagram" ? "Instagram" : "YouTube"}
              </h4>
            </div>
            <ul className="space-y-1.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}