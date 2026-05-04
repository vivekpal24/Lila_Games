/**
 * useGameData.ts — React hook for loading and caching LILA BLACK match sessions.
 *
 * Dataset is expected to be ~few MB per day file. In-browser parsing is appropriate
 * at this scale. If files exceed ~200MB, move aggregation to a backend endpoint and
 * serve pre-aggregated JSON instead of raw parquet.
 *
 * Features:
 *   - In-memory cache: never re-fetches the same filter combination
 *   - progress 0 → 100 as parquet files are parsed one-by-one
 *   - Cleans up on unmount (ignores stale async results)
 */

import { useState, useEffect, useRef } from 'react';
import { loadAllData }                 from '@utils/parquetLoader';
import type { DataFilters, MatchSession } from '@appTypes/telemetry';

// ---------------------------------------------------------------------------
// Module-level cache — persists for the lifetime of the browser tab.
// Key: JSON.stringify(filters)  Value: resolved MatchSession[]
// ---------------------------------------------------------------------------

const sessionCache = new Map<string, MatchSession[]>();

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface GameDataResult {
  sessions: MatchSession[];
  loading:  boolean;
  error:    string | null;
  /** 0–100: percentage of parquet files parsed so far. 100 when complete. */
  progress: number;
  retry:    () => void;
}

// ---------------------------------------------------------------------------
// useGameData
// ---------------------------------------------------------------------------

/**
 * Load and cache LILA BLACK match sessions for the given filters.
 *
 * Calling this hook with the same filters twice never triggers a second fetch —
 * the result is served instantly from the in-memory cache.
 *
 * @example
 *   const { sessions, loading, error, progress } = useGameData({
 *     mapId: MapId.AMBROSE_VALLEY,
 *     date: '2026-02-10',
 *     matchId: null,
 *   });
 */
export function useGameData(filters: DataFilters): GameDataResult {
  const [sessions, setSessions] = useState<MatchSession[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // Ref to detect unmount / stale requests
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const cacheKey = JSON.stringify(filters);

    // Clear stale cache entries to ensure fresh parses with latest worker fixes
    sessionCache.clear();

    // ── Cache hit: instant return ────────────────────────────────────────────
    const cached = sessionCache.get(cacheKey);
    if (cached) {
      setSessions(cached);
      setLoading(false);
      setError(null);
      setProgress(100);
      return;
    }

    // ── Cache miss: load from parquet files ──────────────────────────────────
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setSessions([]);

      void (async () => {
        try {
          const result = await loadAllData(filters, (pct) => {
            if (!cancelledRef.current) setProgress(pct);
          });

          if (cancelledRef.current) return;

          sessionCache.set(cacheKey, result);
          setSessions(result);
          setProgress(100);
        } catch (err) {
          if (cancelledRef.current) return;
          const msg = err instanceof Error ? err.message : 'Unknown error loading data';
          console.error('[useGameData]', err);
          setError(msg);
        } finally {
          if (!cancelledRef.current) setLoading(false);
        }
      })();
    }, 200); // 200ms Debounce

    return () => {
      // Mark as stale — async callbacks above check this before touching state
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  // Filters object reference changes on every render — stringify to stabilise
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), retryCount]);

  const retry = () => setRetryCount(c => c + 1);

  return { sessions, loading, error, progress, retry };
}

// ---------------------------------------------------------------------------
// Cache utilities (exported for testing / dev-tools)
// ---------------------------------------------------------------------------

/** Number of filter combinations currently in the in-memory cache. */
export function getCacheSize(): number {
  return sessionCache.size;
}

/** Clear the entire session cache (e.g. after a data refresh). */
export function clearSessionCache(): void {
  sessionCache.clear();
  console.info('[useGameData] Session cache cleared');
}
