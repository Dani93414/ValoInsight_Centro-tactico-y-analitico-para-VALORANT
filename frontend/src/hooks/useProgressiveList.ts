import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_BATCH_SIZE = 72;

/**
 * Keeps large catalogues searchable in full while mounting only an initial
 * window of cards. More rows are appended as the sentinel approaches.
 */
export function useProgressiveList<T>(
  items: T[],
  resetKey: unknown,
  batchSize = DEFAULT_BATCH_SIZE,
) {
  const [windowState, setWindowState] = useState({ resetKey, batchSize, count: batchSize });
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => setTarget(node), []);
  if (!Object.is(windowState.resetKey, resetKey) || windowState.batchSize !== batchSize) {
    setWindowState({ resetKey, batchSize, count: batchSize });
  }
  const visibleCount = windowState.count;
  const setVisibleCount = useCallback((update: (count: number) => number) => {
    setWindowState((current) => ({ ...current, count: update(current.count) }));
  }, []);

  useEffect(() => {
    if (!target || visibleCount >= items.length) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) =>
            Math.min(items.length, current + batchSize),
          );
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [batchSize, items.length, visibleCount, target, setVisibleCount]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const showMore = useCallback(
    () =>
      setVisibleCount((current) =>
        Math.min(items.length, current + batchSize),
      ),
    [batchSize, items.length, setVisibleCount],
  );
  const revealThrough = useCallback(
    (index: number) =>
      setVisibleCount((current) =>
        Math.max(current, Math.min(items.length, index + 1)),
      ),
    [items.length, setVisibleCount],
  );

  return {
    visibleItems,
    visibleCount,
    hasMore: visibleCount < items.length,
    sentinelRef,
    showMore,
    revealThrough,
  };
}
