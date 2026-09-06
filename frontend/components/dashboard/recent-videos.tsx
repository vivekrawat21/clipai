import Link from "next/link";
import { ArrowUpRight, Scissors } from "lucide-react";
import type { Video } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { VideoThumbnail } from "@/components/videos/video-thumbnail";
import { VideoStatusBadge } from "@/components/ui/status-badge";

export function RecentVideos({
  videos,
  clipCounts,
}: {
  videos: Video[];
  clipCounts: (videoId: number) => number;
}) {
  return (
    <ul className="divide-y divide-border">
      {videos.map((video) => {
        const clips = clipCounts(video.id);
        return (
          <li key={video.id} className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0">
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
              <VideoThumbnail youtubeId={video.youtube_id} alt="" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {video.title ?? `Video #${video.id}`}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <VideoStatusBadge status={video.status} />
                {clips > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Scissors className="size-3" />
                    {clips} clips
                  </span>
                )}
                <span>{formatDate(video.created_at)}</span>
              </div>
            </div>

            <Link
              href={`/videos/${video.id}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Open
              <ArrowUpRight className="size-3.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}