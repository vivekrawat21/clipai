import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline" | "info";

export function badgeVariants({ variant = "secondary", className }: { variant?: BadgeVariant; className?: string } = {}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5";
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary/15 text-primary",
    secondary: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    outline: "border border-border text-muted-foreground",
    info: "bg-sky-500/15 text-sky-400",
  };
  return cn(base, variants[variant], className);
}

export function Badge({
  className,
  variant = "secondary",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={badgeVariants({ variant, className })} {...props} />;
}