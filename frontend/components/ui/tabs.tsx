"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
  listClassName,
}: {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  listClassName?: string;
}) {
  return (
    <div className={className}>
      <div
        role="tablist"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1",
          listClassName,
        )}
      >
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}