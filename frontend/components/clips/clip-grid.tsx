import type { Clip } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClipGrid({
  clips,
  columns = 4,
  className,
  renderCard,
  empty,
}: {
  clips: Clip[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  renderCard: (clip: Clip) => React.ReactNode;
  empty?: React.ReactNode;
}) {
  if (clips.length === 0 && empty) return <>{empty}</>;

  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {clips.map((clip) => renderCard(clip))}
    </div>
  );
}