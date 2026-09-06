import type { Clip } from "@/lib/types";
import { ClipCard } from "@/components/clips/clip-card";

export function RecentClips({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {clips.slice(0, 10).map((clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          selected={false}
          onSelect={() => {}}
          showCheckbox={false}
          compact
        />
      ))}
    </div>
  );
}