/**
 * useAppStore.ts — Global Zustand store for Lila Viz.
 * Manages: raw events, filter state, playback, heatmap mode, active map config.
 *
 * This is a pure client-side tool. No backend. All state lives in the browser.
 */

import { create } from 'zustand';
import {
  MapId,
  type GameEvent,
  type DataFilters,
  type PlaybackState,
  type HeatmapMode,
  type MapConfig,
  type PlaybackSpeed,
} from '@appTypes/telemetry';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AppState {
  // ── Data ──────────────────────────────────────────────────────────────────
  allEvents:  GameEvent[];
  isLoading:  boolean;
  loadError:  string | null;

  // ── Active map ────────────────────────────────────────────────────────────
  activeMapConfig: MapConfig | null;

  // ── Filters ───────────────────────────────────────────────────────────────
  filters: DataFilters;

  // ── Playback ──────────────────────────────────────────────────────────────
  playback: PlaybackState;

  // ── Heatmap ───────────────────────────────────────────────────────────────
  heatmapMode: HeatmapMode;

  // ── Actions ───────────────────────────────────────────────────────────────
  setEvents:          (events: GameEvent[]) => void;
  setLoading:         (loading: boolean) => void;
  setLoadError:       (error: string | null) => void;
  setActiveMapConfig: (config: MapConfig | null) => void;
  updateFilters:      (partial: Partial<DataFilters>) => void;
  resetFilters:       () => void;
  updatePlayback:     (partial: Partial<PlaybackState>) => void;
  setHeatmapMode:     (mode: HeatmapMode) => void;
  setSpeed:           (speed: PlaybackSpeed) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: DataFilters = {
  mapId:   null,
  date:    null,
  matchId: null,
};

const DEFAULT_PLAYBACK: PlaybackState = {
  currentTimeMs: 0,
  durationMs:    0,
  isPlaying:     false,
  speed:         1,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>((set) => ({
  allEvents:       [],
  isLoading:       false,
  loadError:       null,
  activeMapConfig: null,
  filters:         { ...DEFAULT_FILTERS, mapId: MapId.AMBROSE_VALLEY }, // default to primary map
  playback:        DEFAULT_PLAYBACK,
  heatmapMode:     'traffic', // traffic (position density) is most informative default

  setEvents:          (events)  => set({ allEvents: events }),
  setLoading:         (loading) => set({ isLoading: loading }),
  setLoadError:       (error)   => set({ loadError: error }),
  setActiveMapConfig: (config)  => set({ activeMapConfig: config }),

  updateFilters: (partial) =>
    set(state => ({ filters: { ...state.filters, ...partial } })),

  resetFilters: () =>
    set({ filters: { ...DEFAULT_FILTERS, mapId: MapId.AMBROSE_VALLEY } }),

  updatePlayback: (partial) =>
    set(state => ({ playback: { ...state.playback, ...partial } })),

  setHeatmapMode: (mode)  => set({ heatmapMode: mode }),

  setSpeed: (speed) =>
    set(state => ({ playback: { ...state.playback, speed } })),
}));
