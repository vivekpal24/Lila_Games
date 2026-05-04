// useParquet.ts — Loads Parquet data files on mount and populates the store.
// Add URLs to DATA_FILES to load additional datasets.

import { useEffect } from 'react';
import { loadParquetFile } from '@utils/parquetLoader';
import { useAppStore }     from '@store/useAppStore';
import { getTimeRange }    from '@utils/statsEngine';

// ---------------------------------------------------------------------------
// Data file manifest — point these at /public/data/*.parquet (or .arrow)
// ---------------------------------------------------------------------------
const DATA_FILES: string[] = [
  '/data/events.parquet',
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useParquet(): void {
  const setEvents    = useAppStore(s => s.setEvents);
  const setLoading   = useAppStore(s => s.setLoading);
  const setLoadError = useAppStore(s => s.setLoadError);
  const updatePlayback = useAppStore(s => s.updatePlayback);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const chunks = await Promise.all(DATA_FILES.map(url => loadParquetFile(url)));

        if (cancelled) return;

        const events = chunks.flat();
        const [minMs, maxMs] = getTimeRange(events);

        setEvents(events);
        updatePlayback({
          currentTimeMs: minMs,
          durationMs:    maxMs - minMs,
        });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error loading data';
          setLoadError(msg);
          console.error('[useParquet]', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
