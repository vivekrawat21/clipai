import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
  label,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-all duration-300 ease-out",
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}