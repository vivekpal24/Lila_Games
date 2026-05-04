/**
 * telemetry.ts — All TypeScript types for LILA BLACK player event data.
 *
 * This is a client-side analytics tool. In-browser parquet parsing eliminates
 * backend complexity and keeps deployment to a single static host. For datasets
 * exceeding ~500MB, this architecture would be revisited to add a backend
 * aggregation layer.
 *
 * Schema source: player_data/README.md
 * Data range:    February 10–14, 2026
 * Files:         1,243 parquet files (no .parquet extension)
 * Rows:          ~89,000 events across 796 matches
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * All possible values for the `event` column in the parquet files.
 * Stored as bytes in parquet — decoded to UTF-8 string before use.
 */
export const EventType = {
  /** A human player's world position was sampled (movement tracking). Most frequent event. */
  Position:      'Position',

  /** A bot's world position was sampled (AI movement tracking). */
  BotPosition:   'BotPosition',

  /** This human player killed another human player. */
  Kill:          'Kill',

  /** This human player was killed by another human player. */
  Killed:        'Killed',

  /** This human player killed a bot. */
  BotKill:       'BotKill',

  /** This human player was killed by a bot. */
  BotKilled:     'BotKilled',

  /** This player died to the storm (the shrinking play zone). */
  KilledByStorm: 'KilledByStorm',

  /** This player picked up an item from the environment. */
  Loot:          'Loot',
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

/**
 * Whether the subject of a file/event is a human player or a bot.
 * Determined by the shape of user_id: UUID → HUMAN, short numeric string → BOT.
 */
export const PlayerType = {
  /** Human player. user_id is a UUID, e.g. "f4e072fa-b7af-4761-b567-1d95b7ad0108". */
  HUMAN: 'human',

  /** Bot (AI-controlled opponent). user_id is a short numeric string, e.g. "1440". */
  BOT:   'bot',
} as const;

export type PlayerType = typeof PlayerType[keyof typeof PlayerType];

/**
 * The three maps currently in rotation in LILA BLACK.
 * Values exactly match the map_id strings in the parquet data.
 */
export const MapId = {
  /** Primary map — most played. Coordinate scale=900, originX=-370, originZ=-473. */
  AMBROSE_VALLEY: 'AmbroseValley',

  /** Secondary map. Coordinate scale=581, originX=-290, originZ=-290. */
  GRAND_RIFT:     'GrandRift',

  /** Smaller, close-quarters map. Coordinate scale=1000, originX=-500, originZ=-500. */
  LOCKDOWN:       'Lockdown',
} as const;

export type MapId = typeof MapId[keyof typeof MapId];

// ---------------------------------------------------------------------------
// Raw parquet row (before any decoding/normalization)
// ---------------------------------------------------------------------------

/**
 * The raw shape of one row as returned by apache-arrow before any decoding.
 * The `event` column arrives as a Uint8Array (binary) and must be decoded.
 * Internal use only — components consume NormalizedRow instead.
 */
export interface RawParquetRow {
  /** Player or bot identifier. UUID = human, numeric string = bot. */
  readonly user_id:  string;

  /** Match identifier including server suffix, e.g. "abc123.nakama-0". */
  readonly match_id: string;

  /** Map name as a string — one of the MapId enum values. */
  readonly map_id:   string;

  /** World X coordinate. Used for 2D minimap plotting. */
  readonly x:        number;

  /**
   * World Y coordinate — this is ELEVATION/HEIGHT in 3D space.
   * Do NOT use for 2D minimap plotting. Use x and z instead.
   */
  readonly y:        number;

  /** World Z coordinate. Used for 2D minimap plotting (alongside x). */
  readonly z:        number;

  /**
   * Milliseconds elapsed within the match (not wall-clock time).
   * Epoch origin is arbitrary — use relative ordering within a match_id.
   */
  readonly ts:       number;

  /**
   * Event type stored as binary bytes in parquet.
   * Decode with TextDecoder or String.fromCharCode to get a readable EventType string.
   */
  readonly event:    Uint8Array | string;
}

// ---------------------------------------------------------------------------
// Normalized base event (all events share these fields)
// ---------------------------------------------------------------------------

interface BaseEvent {
  /** Unique player or bot identifier. UUID = human, numeric string = bot. */
  readonly userId:     string;

  /**
   * Match identifier. The raw parquet value includes a ".nakama-0" suffix
   * (the game server instance). This field stores the raw value as-is.
   */
  readonly matchId:    string;

  /** Which map this event occurred on. */
  readonly mapId:      MapId;

  /**
   * World X coordinate of the event.
   * Use this for 2D minimap plotting alongside `worldZ`.
   */
  readonly worldX:     number;

  /**
   * World Y coordinate — represents ELEVATION (height above terrain) in 3D space.
   * Not used for 2D minimap plotting. Useful for multi-floor or elevation analysis.
   */
  readonly elevation:  number;

  /**
   * World Z coordinate of the event.
   * Use this for 2D minimap plotting alongside `worldX`.
   */
  readonly worldZ:     number;

  /**
   * Milliseconds elapsed from the match start.
   * Use this to order events within a match and drive timeline playback.
   * Epoch is relative to the match — do not compare across different match_ids.
   */
  readonly timestampMs: number;

  /** Whether this event belongs to a human (UUID user_id) or a bot (numeric user_id). */
  readonly playerType: PlayerType;
}

// ---------------------------------------------------------------------------
// Per-event-type interfaces
// ---------------------------------------------------------------------------

/** A human player's world position was sampled. Bulk of the dataset (~85%+). */
export interface MovementEvent extends BaseEvent {
  readonly eventType: typeof EventType.Position;
}

/** A bot's world position was sampled. Equivalent of MovementEvent for AI-controlled bots. */
export interface BotMovementEvent extends BaseEvent {
  readonly eventType: typeof EventType.BotPosition;
}

/**
 * This human player killed another human player.
 * The victim's identity is not encoded in this row — correlate by match_id + ts
 * to find the matching KilledEvent.
 */
export interface KillEvent extends BaseEvent {
  readonly eventType: typeof EventType.Kill;
}

/**
 * This human player was killed by another human player.
 * The killer's identity is not encoded in this row — correlate by match_id + ts
 * to find the matching KillEvent.
 */
export interface DeathEvent extends BaseEvent {
  readonly eventType: typeof EventType.Killed;
}

/**
 * This human player killed a bot.
 * The bot's identity is not encoded in this row.
 */
export interface BotKillEvent extends BaseEvent {
  readonly eventType: typeof EventType.BotKill;
}

/**
 * This human player was killed by a bot.
 * The bot's identity is not encoded in this row.
 */
export interface BotKilledEvent extends BaseEvent {
  readonly eventType: typeof EventType.BotKilled;
}

/**
 * This player was killed by the storm — the shrinking play zone that sweeps
 * across the map during a match, forcing players to move and extract.
 */
export interface StormDeathEvent extends BaseEvent {
  readonly eventType: typeof EventType.KilledByStorm;
}

/**
 * This player picked up an item from the environment.
 * No item identity is recorded in the schema.
 */
export interface LootEvent extends BaseEvent {
  readonly eventType: typeof EventType.Loot;
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

/**
 * Any single event record from the LILA BLACK dataset.
 * Discriminated by the `eventType` field.
 */
export type GameEvent =
  | MovementEvent
  | BotMovementEvent
  | KillEvent
  | DeathEvent
  | BotKillEvent
  | BotKilledEvent
  | StormDeathEvent
  | LootEvent;

// ---------------------------------------------------------------------------
// Match session
// ---------------------------------------------------------------------------

/**
 * Aggregated view of a single match, assembled from all parquet files
 * that share the same match_id.
 */
export interface MatchSession {
  /** The match identifier (raw value, includes ".nakama-0" suffix). */
  readonly matchId:         string;

  /** Which map this match was played on. */
  readonly mapId:           MapId;

  /**
   * Earliest timestamp in the match.
   * Null if the session has no events.
   */
  readonly startTime:       Date | null;

  /**
   * Latest timestamp in the match.
   * Null if the session has no events.
   */
  readonly endTime:         Date | null;

  /** Total duration in seconds (endTime - startTime). 0 if either is null. */
  readonly durationSeconds: number;

  /** Number of distinct human player user_ids in this match. */
  readonly humanCount:      number;

  /** Number of distinct bot user_ids in this match. */
  readonly botCount:        number;

  /**
   * True if this match session should be excluded from analysis.
   * A session is invalid if it has fewer than 2 human players —
   * e.g. a test session, an incomplete file load, or corrupt data.
   */
  readonly isInvalid:       boolean;

  /** All events belonging to this match, in ascending timestamp order. */
  readonly events:          GameEvent[];
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/**
 * The three user-facing filter dimensions surfaced in the Filters panel.
 * All fields are nullable — null means "no filter applied" (show all).
 */
export interface DataFilters {
  /** Filter to a single map. Null = show all maps. */
  mapId:    MapId    | null;

  /**
   * Filter to events from a specific calendar date.
   * Format: 'YYYY-MM-DD'. Null = show all dates.
   */
  date:     string   | null;

  /** Filter to a single match. Null = show all matches. */
  matchId:  string   | null;
}

// ---------------------------------------------------------------------------
// Map coordinate configuration
// ---------------------------------------------------------------------------

/**
 * MapConfig is defined in and owned by coordinateMapper.ts.
 * It uses auto-calibrated world bounds derived from real event data.
 * Re-exported here so consumers can import from a single types module.
 */
export type { MapConfig } from '@utils/coordinateMapper';

// ---------------------------------------------------------------------------
// Heatmap mode
// ---------------------------------------------------------------------------

/**
 * Which category of events to aggregate in the heatmap layer.
 * - kills:   Kill + BotKill events
 * - deaths:  Killed + BotKilled + KilledByStorm events
 * - traffic: Position + BotPosition events (player path density)
 */
export type HeatmapMode = 'kills' | 'deaths' | 'traffic';

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

export type PlaybackSpeed = 0.5 | 1 | 2 | 5;

/** State for the timeline scrubber and playback controls. */
export interface PlaybackState {
  /** Current playback position in milliseconds from match start. */
  readonly currentTimeMs: number;

  /** Total match duration in milliseconds. */
  readonly durationMs:    number;

  /** Whether the timeline is currently advancing. */
  readonly isPlaying:     boolean;

  /** Playback speed multiplier relative to real match time. */
  readonly speed:         PlaybackSpeed;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Result of validating coordinate mapping for a batch of events.
 * Counts are based on RAW (unclamped) pixel positions.
 * Show this in the debug overlay during development.
 */
export interface ValidationResult {
  readonly totalEvents:      number;
  readonly inBoundsCount:    number;
  readonly outOfBoundsCount: number;
  /** Alias for outOfBoundsCount — used by validateMapping() return value. */
  readonly outlierCount:     number;
  /** Percentage of events outside minimap bounds before clamping. */
  readonly outlierPercent:   number;
  /** True if outlierPercent ≤ 2%. */
  readonly isValid:          boolean;
}
