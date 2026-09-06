"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { youtubeThumbnail } from "@/lib/format";

export function VideoThumbnail({
  youtubeId,
  alt,
  className,
  priority = false,
}: {
  youtubeId: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [src, setSrc] = useState(() => youtubeThumbnail(youtubeId, "maxres"));
  const [failed, setFailed] = useState(false);
  const attempts = useRef(0);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground animate-fade-in",
          className,
        )}
      >
        <Clapperboard className="size-8 opacity-40" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(max-width: 640px) 100vw, 320px"
      onError={() => {
        attempts.current += 1;
        if (attempts.current === 1) setSrc(youtubeThumbnail(youtubeId, "hq"));
        else setFailed(true);
      }}
      className={cn("object-cover", className)}
      priority={priority}
      draggable={false}
    />
  );
}