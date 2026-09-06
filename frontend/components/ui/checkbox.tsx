import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  label,
  indeterminate,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  indeterminate?: boolean;
  className?: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-transparent hover:border-primary/50",
        className,
      )}
    >
      {indeterminate ? (
        <Minus className="size-3.5" />
      ) : checked ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : null}
    </button>
  );
}