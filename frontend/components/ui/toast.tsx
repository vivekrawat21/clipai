"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  const toast = useCallback((input: ToastInput) => {
    counter.current += 1;
    const id = `toast-${counter.current}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-3), { id, variant: "default", ...input }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: () => void;
}) {
  const Icon =
    toast.variant === "success"
      ? Check
      : toast.variant === "error"
        ? CircleAlert
        : Info;
  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-xl shadow-black/20 backdrop-blur animate-toast-in",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          toast.variant === "success" && "text-success",
          toast.variant === "error" && "text-destructive",
          toast.variant === "info" && "text-info",
          toast.variant === "default" && "text-primary",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}