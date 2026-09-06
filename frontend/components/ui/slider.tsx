import { useId } from "react";
import { cn } from "@/lib/utils";

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onValueChange,
  ariaLabel,
  className,
}: {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("relative flex h-5 items-center", className)}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
      <div className="relative h-1.5 w-full rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 hidden size-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow peer-hover:block peer-focus-visible:block"
        style={{ left: `calc(${pct}% - 7px)` }}
      />
    </div>
  );
}