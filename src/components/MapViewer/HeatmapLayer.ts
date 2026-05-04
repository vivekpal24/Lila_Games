/**
 * HeatmapLayer.ts — Aggregate density overlay for kills, deaths, or player traffic.
 *
 * NOT time-gated — shows full match heatmap always.
 * Rationale: heatmaps are aggregate views, not real-time. Time-gating heatmaps
 * creates misleading partial pictures and adds complexity for little benefit.
 *
 * Rendered only when showHeatmap is true in the store.
 */

import { useMemo, useCallback }          from 'react';
import { HeatmapLayer }     from '@deck.gl/aggregation-layers';
import { EventType, type GameEvent } from '@appTypes/telemetry';
import { worldToPixel, type MapConfig } from '@utils/coordinateMapper';
import { useAppStore, type HeatmapMode } from '@store/appStore';

// ---------------------------------------------------------------------------
// Color ranges (6 stops each, low → high density)
// ---------------------------------------------------------------------------

type ColorStop = [number, number, number, number];

const COLOR_RANGES: Record<HeatmapMode, ColorStop[]> = {
  kills: [
    [254, 235, 226, 255],
    [252, 174, 145, 255],
    [251, 106,  74, 255],
    [239,  59,  44, 255],
    [203,  24,  29, 255],
    [153,   0,  13, 255],
  ],
  deaths: [
    [255, 247, 188, 255],
    [254, 227, 145, 255],
    [254, 196,  79, 255],
    [254, 153,  41, 255],
    [217,  95,  14, 255],
    [153,  52,   4, 255],
  ],
  traffic: [
    [237, 248, 255, 255],
    [198, 219, 239, 255],
    [158, 202, 225, 255],
    [ 49, 130, 189, 255],
    [  8, 104, 172, 255],
    [  8,  48,  107, 255],
  ],
};

// ---------------------------------------------------------------------------
// Which event types feed each mode
// ---------------------------------------------------------------------------

const MODE_EVENTS: Record<HeatmapMode, ReadonlySet<EventType>> = {
  kills:   new Set([EventType.Kill,     EventType.BotKill]),
  deaths:  new Set([EventType.Killed,   EventType.BotKilled, EventType.KilledByStorm, EventType.Kill, EventType.BotKill]),
  traffic: new Set([EventType.Position, EventType.BotPosition]),
};

// ---------------------------------------------------------------------------
// Sampling for traffic mode (can be very large)
// ---------------------------------------------------------------------------

const MAX_HEATMAP_POINTS = 30_000;

function sampleForHeatmap(events: GameEvent[]): GameEvent[] {
  if (events.length <= MAX_HEATMAP_POINTS) return events;
  
  // Only log once per session to keep console clean
  const logKey = `downsample-${events.length}`;
  if (!(window as any)._lila_logs) (window as any)._lila_logs = new Set();
  if (!(window as any)._lila_logs.has(logKey)) {
    console.warn(`[HeatmapLayer] Downsampling for performance: ${events.length} → ${MAX_HEATMAP_POINTS}`);
    (window as any)._lila_logs.add(logKey);
  }

  const result = events.slice(0, MAX_HEATMAP_POINTS);
  for (let i = MAX_HEATMAP_POINTS; i < events.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < MAX_HEATMAP_POINTS) result[j] = events[i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHeatmapLayer(
  allEvents: GameEvent[],
  config: MapConfig | null,
): HeatmapLayer<GameEvent> | null {
  const showHeatmap = useAppStore(s => s.showHeatmap);
  const mode        = useAppStore(s => s.heatmapMode);

  const heatmapData = useMemo(() => {
    if (!showHeatmap) return [];

    const allowed = MODE_EVENTS[mode];
    const filtered = allEvents.filter(ev => allowed.has(ev.eventType));
    return sampleForHeatmap(filtered);
  }, [allEvents, showHeatmap, mode]);

  const getPosition = useCallback((d: GameEvent) => {
    if (!config) return [0, 0];
    const { px, py } = worldToPixel(d.worldX, d.worldZ, config);
    return [px, py];
  }, [config]);

  return useMemo(() => {
    if (!showHeatmap || heatmapData.length === 0) return null;

    return new HeatmapLayer<GameEvent>({
      id:           'heatmap-layer-stable',
      data:          heatmapData,
      pickable:      false,
      opacity:       0.3,
      getPosition:  getPosition,
      getWeight:    1,
      radiusPixels: 40,
      intensity:    1,
      threshold:    0.05,
      colorRange:   COLOR_RANGES[mode],
      updateTriggers: {
        getPosition: [config, mode],
      },
    });
  }, [showHeatmap, heatmapData, mode, config, getPosition]);
}
