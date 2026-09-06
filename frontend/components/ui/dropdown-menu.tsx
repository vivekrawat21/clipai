"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownItem {
  label: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <div
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex"
      >
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          id={menuId}
          className={cn(
            "absolute top-full z-40 mt-1.5 min-w-48 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/30 animate-scale-in",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => {
            if (item.separator) {
              return <div key={i} role="separator" className="my-1 h-px bg-border" />;
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
                  item.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}