"use client";

import { useCallback, useSyncExternalStore } from "react";

function readValue<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

/**
 * Persistent local preferences backed by localStorage.
 *
 * Values are read from localStorage so setState-in-effect lint rules are
 * avoided, and writes signal the same-tab subscriber with a synthetic
 * storage event — the pattern `useSyncExternalStore` was designed for.
 * Primitives only (snapshots must be referentially stable).
 */
export function useLocalStorage<T>(key: string, fallback: T) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onStoreChange();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    [key],
  );

  const getSnapshot = useCallback(() => readValue(key, fallback), [key, fallback]);

  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => fallback,
  );

  const setItem = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      // Same-tab subscribers don't receive storage events — notify manually.
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key],
  );

  return [value, setItem] as const;
}