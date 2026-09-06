import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
        <Clapperboard className="size-4.5" strokeWidth={2.2} />
      </span>
      {showWordmark && (
        <span className="text-base font-bold tracking-tight text-foreground">
          Clip<span className="text-primary">AI</span>
        </span>
      )}
    </span>
  );
}