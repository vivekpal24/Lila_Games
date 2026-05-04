// useFilters.ts — Derives filteredEvents from the store based on current DataFilters.
// All filtering is done in-browser on the full parsed dataset.

import { useMemo, useCallback } from 'react';
import { useAppStore }          from '@store/appStore';
import { applyFilters, filterByTimeline } from '@utils/statsEngine';
import type { DataFilters, GameEvent } from '@appTypes/telemetry';

interface FilterControls {
  filteredEvents: GameEvent[];
  filters:        DataFilters;
  updateFilters:  (partial: Partial<DataFilters>) => void;
  resetFilters:   () => void;
}

export function useFilters(allEvents: GameEvent[]): FilterControls {
  // 1. Pull individual filter values from store
  const selectedMapId   = useAppStore(s => s.selectedMapId);
  const selectedDate    = useAppStore(s => s.selectedDate);
  const selectedMatchId = useAppStore(s => s.selectedMatchId);
  const playbackTime    = useAppStore(s => s.playbackTime);

  // 2. Pull actions
  const setFilter     = useAppStore(s => s.setFilter);
  const resetFilters  = useAppStore(s => s.resetFilters);

  // 3. Reconstruct a DataFilters object for the UI
  const filters = useMemo<DataFilters>(() => ({
    mapId:   selectedMapId,
    date:    selectedDate,
    matchId: selectedMatchId,
  }), [selectedMapId, selectedDate, selectedMatchId]);

  // 4. Implement updateFilters by mapping back to setFilter
  const updateFilters = useCallback((partial: Partial<DataFilters>) => {
    if ('mapId' in partial)   setFilter('selectedMapId', partial.mapId!);
    if ('date' in partial)    setFilter('selectedDate', partial.date!);
    if ('matchId' in partial) setFilter('selectedMatchId', partial.matchId!);
  }, [setFilter]);

  // 5. Compute filteredEvents
  const filteredEvents = useMemo(() => {
    // A. Apply static dimension filters (map, date, match)
    let result = applyFilters(allEvents, filters);

    // B. Apply timeline window (revealing events as time passes)
    result = filterByTimeline(result, playbackTime * 1000);

    return result;
  }, [allEvents, filters, playbackTime]);

  return { filteredEvents, filters, updateFilters, resetFilters };
}

