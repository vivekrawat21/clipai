import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "destructive"
  | "success"
  | "link";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
  ghost: "text-foreground hover:bg-muted/70",
  outline:
    "border border-input bg-transparent text-foreground hover:bg-muted/60",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-white hover:bg-success/90",
  link: "text-primary underline-offset-4 hover:underline h-auto px-0",
};

const sizeClasses: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5",
  sm: "h-8 px-3 text-sm gap-2",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
  icon: "h-9 w-9",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex select-none items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner className="size-4" />}
        {children}
      </button>
    );
  },
);