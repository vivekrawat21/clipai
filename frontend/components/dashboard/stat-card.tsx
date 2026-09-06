import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  label,
  value,
  trend,
  trendPositive,
  accent = "primary",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  trend?: string;
  trendPositive?: boolean;
  accent?: "primary" | "success" | "warning" | "info";
}) {
  const accentClasses = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border/80">
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", accentClasses[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {trend && (
            <span
              className={cn(
                "text-xs font-medium",
                trendPositive === undefined ? "text-muted-foreground" : trendPositive ? "text-success" : "text-destructive",
              )}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}