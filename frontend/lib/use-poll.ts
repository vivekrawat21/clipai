"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reusable polling hook for asynchronous backend work (Celery jobs).
 *
 * Polls `fetcher` while its result returns `false` for `shouldContinueD`.
 * Stops when the result is terminal or an error is thrown.
 *
 * Returns the latest result, whether a poll loop is in-flight, and an
 * error (thrown by the fetcher). Supports manual refresh + immediate stop.
 */
export function usePoll<T>({
  fetcher,
  interval = 2500,
  enabled = true,
  shouldStop,
  onError,
}: {
  fetcher: () => Promise<T>;
  interval?: number;
  enabled?: boolean;
  /** Return true when the result is terminal and polling should stop. */
  shouldStop: (result: T) => boolean;
  onError?: (error: unknown) => void;
}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<unknown>(null);

  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  const shouldStopRef = useRef(shouldStop);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
    onErrorRef.current = onError;
    shouldStopRef.current = shouldStop;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const run = async (isFirst: boolean) => {
      try {
        const result = await fetcherRef.current();
        if (cancelled) return;
        setData(result);
        setError(null);
        if (shouldStopRef.current(result)) {
          setLoading(false);
          if (intervalId) clearInterval(intervalId);
          return;
        }
        setLoading(isFirst);
      } catch (caught) {
        if (cancelled) return;
        setError(caught);
        setLoading(false);
        onErrorRef.current?.(caught);
        if (intervalId) clearInterval(intervalId);
      }
    };

    void run(true);
    intervalId = setInterval(() => void run(false), interval);

    stopRef.current = () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      setLoading(false);
    };

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stopRef.current = null;
    };
  }, [enabled, interval]);

  const stop = useCallback(() => {
    stopRef.current?.();
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void fetcherRef.current()
      .then((result) => {
        setData(result);
        setError(null);
        if (shouldStopRef.current(result)) setLoading(false);
      })
      .catch((caught) => {
        setError(caught);
        setLoading(false);
        onErrorRef.current?.(caught);
      });
  }, []);

  return { data, loading, error, stop, refresh };
}