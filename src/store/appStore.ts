/**
 * appStore.ts — Global Zustand store for Lila Viz.
 *
 * No side effects in this file. Pure state + synchronous actions only.
 * All data loading lives in useGameData.ts. All rendering lives in components.
 *
 * Issue #8 fix: movement data is sampled (not every raw point) — see usePlayerPath.
 */

import { create } from 'zustand';
import { useMemo } from 'react';
import {
  EventType,
  PlayerType,
  type GameEvent,
  MapId,
} from '@appTypes/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeatmapMode = 'kills' | 'deaths' | 'traffic';
export type PlaybackSpeed = 1 | 2 | 5;

/** Keys in AppState that represent filter dimensions. */
export type FilterKey = 'selectedMapId' | 'selectedDate' | 'selectedMatchId';

/** Keys in AppState that represent boolean layer toggles. */
export type LayerKey =
  | 'showMovementPaths'
  | 'showKills'
  | 'showDeaths'
  | 'showStormDeaths'
  | 'showLoot'
  | 'showHeatmap'
  | 'showBots';

/** Infer the value type for a given FilterKey. */
type FilterValue<K extends FilterKey> = AppState[K];

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AppState {
  // ── Filters ───────────────────────────────────────────────────────────────
  selectedMapId: MapId | null;
  selectedDate: string | null;   // 'YYYY-MM-DD'
  selectedMatchId: string | null;

  // ── Playback ──────────────────────────────────────────────────────────────
  /** Seconds elapsed from match start. Clamped to [0, matchDuration]. */
  playbackTime: number;
  /** Total duration of the current match in seconds. Used for clamping. */
  matchDuration: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;

  // ── Layers (only the 5 core layers — no bonus layers until core works) ────
  showMovementPaths: boolean;
  showKills: boolean;
  showDeaths: boolean;
  showStormDeaths: boolean;
  showLoot: boolean;
  showHeatmap: boolean;
  heatmapMode: HeatmapMode;
  /** When false, bot events are excluded from all layers. */
  showBots: boolean;

  // ── UI ────────────────────────────────────────────────────────────────────
  selectedPlayerId: string | null;
  hoveredEventId: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  /** Update a filter field. Resets playbackTime → 0 and clears selectedPlayerId. */
  setFilter: <K extends FilterKey>(key: K, value: FilterValue<K>) => void;
  /** Clamp t to [0, matchDuration] and update playbackTime. */
  setPlaybackTime: (t: number) => void;
  /** Set the total match duration in seconds (called when a match loads). */
  setMatchDuration: (d: number) => void;
  togglePlay: () => void;
  setPlaybackSpeed: (s: PlaybackSpeed) => void;
  /** Toggle a boolean layer key. */
  toggleLayer: (key: LayerKey) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  /** Set the focused player (null to deselect). */
  selectPlayer: (id: string | null) => void;
  /** Set the hovered event id (null to clear). */
  hoverEvent: (id: string | null) => void;
  /** Reset all filters and playback. */
  resetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  selectedMapId: null,
  selectedDate: null,
  selectedMatchId: null,
  playbackTime: 0,
  matchDuration: 0,
  isPlaying: false,
  playbackSpeed: 1 as PlaybackSpeed,
  showMovementPaths: true,
  showKills: true,
  showDeaths: true,
  showStormDeaths: true,
  showLoot: true,
  showHeatmap: true,
  heatmapMode: 'traffic' as HeatmapMode,
  showBots: true,
  selectedPlayerId: null,
  hoveredEventId: null,
} satisfies Omit<AppState, keyof ReturnType<typeof makeActions>>;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeActions(
  set: (fn: (s: AppState) => Partial<AppState>) => void,
  get: () => AppState,
) {
  return {
    setFilter: <K extends FilterKey>(key: K, value: FilterValue<K>) =>
      set(() => {
        const updates: Partial<AppState> = {
          [key]: value,
          playbackTime: 0,
          isPlaying: false,
          selectedPlayerId: null,
        };
        // Changing map or date invalidates the current match selection
        if (key === 'selectedMapId' || key === 'selectedDate') {
          updates.selectedMatchId = null;
        }
        return updates;
      }),

    setPlaybackTime: (t: number) =>
      set((s) => ({
        playbackTime: Math.max(0, Math.min(t, s.matchDuration)),
      })),

    setMatchDuration: (d: number) =>
      set(() => ({ matchDuration: Math.max(0, d) })),

    togglePlay: () =>
      set((s) => ({ isPlaying: !s.isPlaying })),

    setPlaybackSpeed: (speed: PlaybackSpeed) =>
      set(() => ({ playbackSpeed: speed })),

    toggleLayer: (key: LayerKey) =>
      set((s) => ({ [key]: !s[key] })),

    setHeatmapMode: (mode: HeatmapMode) =>
      set(() => ({ heatmapMode: mode })),

    selectPlayer: (id: string | null) =>
      set(() => ({ selectedPlayerId: id })),

    hoverEvent: (id: string | null) =>
      set(() => ({ hoveredEventId: id })),

    resetFilters: () =>
      set(() => ({
        selectedMapId: null,
        selectedDate: null,
        selectedMatchId: null,
        playbackTime: 0,
        isPlaying: false,
        selectedPlayerId: null,
      })),

    // makeActions needs get() to satisfy the type; it's used for future derived actions.
    _get: get,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...DEFAULTS,
  ...makeActions(set, get),
}));

// ---------------------------------------------------------------------------
// Selector: which EventTypes each layer toggle controls
// ---------------------------------------------------------------------------

const LAYER_EVENT_TYPES: Record<LayerKey, ReadonlySet<EventType>> = {
  showMovementPaths: new Set([EventType.Position, EventType.BotPosition]),
  showKills: new Set([EventType.Kill, EventType.BotKill]),
  showDeaths: new Set([EventType.Killed, EventType.BotKilled]),
  showStormDeaths: new Set([EventType.KilledByStorm]),
  showLoot: new Set([EventType.Loot]),
  // showHeatmap and showBots are cross-cutting — not event-type filtered here
  showHeatmap: new Set<EventType>(),
  showBots: new Set<EventType>(),
};

/** Build the set of permitted EventTypes from current layer state. */
function buildAllowedTypes(state: AppState): Set<EventType> {
  const allowed = new Set<EventType>();
  const LAYER_KEYS: LayerKey[] = [
    'showMovementPaths',
    'showKills',
    'showDeaths',
    'showStormDeaths',
    'showLoot',
  ];
  for (const key of LAYER_KEYS) {
    if (state[key]) {
      for (const t of LAYER_EVENT_TYPES[key]) allowed.add(t);
    }
  }
  return allowed;
}

// ---------------------------------------------------------------------------
// Selector: useVisibleEvents
// ---------------------------------------------------------------------------

/**
 * Returns the subset of events that should be rendered given current store state.
 *
 * Filtered by:
 *   1. playbackTime window  — only events with timestampMs ≤ (playbackTime * 1000)
 *   2. Active layer toggles — only event types whose layer is toggled on
 *   3. showBots flag        — when false, bot events (playerType === BOT) are excluded
 *
 * Memoised: only recomputes when events array reference or relevant store state changes.
 */
export function useVisibleEvents(events: GameEvent[]): GameEvent[] {
  const playbackTime = useAppStore(s => s.playbackTime);
  const showBots = useAppStore(s => s.showBots);

  // Select individual fields to avoid new object reference on every render
  const showMovementPaths = useAppStore(s => s.showMovementPaths);
  const showKills = useAppStore(s => s.showKills);
  const showDeaths = useAppStore(s => s.showDeaths);
  const showStormDeaths = useAppStore(s => s.showStormDeaths);
  const showLoot = useAppStore(s => s.showLoot);

  return useMemo(() => {
    const startMs = events.length > 0 ? events[0].timestampMs : 0;
    // Buffer: Always show the first 2 seconds of the match so the map isn't empty at 0:00
    const cutoffMs = startMs + (playbackTime * 1_000) + 2000;

    const allowed = buildAllowedTypes({
      ...useAppStore.getState(),
      showMovementPaths,
      showKills,
      showDeaths,
      showStormDeaths,
      showLoot,
    });

    const filtered = events.filter(ev => {
      // 1. Timeline window (relative to start)
      if (ev.timestampMs > cutoffMs) return false;
      // 2. Layer toggle
      if (!allowed.has(ev.eventType)) return false;
      // 3. Bot filter
      if (!showBots && ev.playerType === PlayerType.BOT) return false;
      return true;
    });

    if (events.length > 0 && filtered.length === 0) {
      console.warn(`[useVisibleEvents] Debug: All ${events.length} events were filtered out. CutoffMs: ${cutoffMs}, StartMs: ${startMs}, AllowedTypes: ${Array.from(allowed).join(',')}`);
    } else if (events.length > 0) {
    }

    return filtered;
  }, [events, playbackTime, showBots, showMovementPaths, showKills, showDeaths, showStormDeaths, showLoot]);
}

// ---------------------------------------------------------------------------
// Selector: usePlayerPath
// ---------------------------------------------------------------------------

/**
 * Returns sampled world-space [worldX, worldZ] positions for a single player
 * up to the current playbackTime.
 *
 * FIXES ISSUE #8: Movement data is sampled at 1-second intervals for smooth playback.
 * Raw event density can be thousands of points/second which causes visible lag.
 * This tradeoff prioritizes smooth UX over perfect fidelity.
 *
 * Algorithm:
 *   1. Filter to this player's Position/BotPosition events up to playbackTime.
 *   2. Walk events in timestamp order.
 *   3. Emit a point only when the next event is ≥ 1 second after the last emitted point.
 *   4. Always emit the final point so the path ends at the player's current position.
 *
 * @param events   - Full event array (filtered by match/map upstream)
 * @param playerId - userId of the player to trace
 * @returns        Array of [worldX, worldZ] world-space coordinate pairs
 */
export function usePlayerPath(
  events: GameEvent[],
  playerId: string,
): [number, number][] {
  const playbackTime = useAppStore(s => s.playbackTime);

  return useMemo(() => {
    const MOVEMENT_TYPES: ReadonlySet<EventType> = new Set([
      EventType.Position,
      EventType.BotPosition,
    ]);

    const cutoffMs = playbackTime * 1_000;
    const SAMPLE_MS = 1_000; // 1-second sampling interval

    // Filter to this player's movement events within the playback window
    const movements = events.filter(
      ev =>
        ev.userId === playerId &&
        MOVEMENT_TYPES.has(ev.eventType) &&
        ev.timestampMs <= cutoffMs,
    );

    if (movements.length === 0) return [];

    const path: [number, number][] = [];
    let lastEmittedMs = -Infinity;

    for (let i = 0; i < movements.length; i++) {
      const ev = movements[i];
      const isLast = i === movements.length - 1;

      if (isLast || ev.timestampMs - lastEmittedMs >= SAMPLE_MS) {
        path.push([ev.worldX, ev.worldZ]);
        lastEmittedMs = ev.timestampMs;
      }
    }

    return path;
  }, [events, playerId, playbackTime]);
}
