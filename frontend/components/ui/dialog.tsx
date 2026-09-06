"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DialogContext = createContext<{ onClose: () => void } | null>(null);

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}: DialogProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    },
    [open, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    panelRef.current?.focus();
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus?.();
    };
  }, [open, handleKey]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <DialogContext.Provider value={{ onClose }}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl shadow-black/40 outline-none animate-slide-up sm:rounded-2xl",
            sizeMap[size],
          )}
        >
          {(title || description) && (
            <header className="flex items-start justify-between gap-4 border-b border-border px-6 pb-4 pt-5">
              <div className="min-w-0">
                {title && (
                  <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0"
              >
                <X className="size-4" />
              </Button>
            </header>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </div>
      </DialogContext.Provider>
    </div>,
    document.body,
  );
}

/** Close the dialog from within content. */
export function useDialogClose() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialogClose must be used inside a Dialog");
  return ctx.onClose;
}