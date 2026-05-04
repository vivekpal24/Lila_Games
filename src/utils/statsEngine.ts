/**
 * statsEngine.ts — In-browser aggregation, filtering, and session assembly
 * for LILA BLACK telemetry data.
 *
 * All computation runs on the parsed GameEvent array. No backend needed.
 */

import {
  EventType,
  MapId,
  PlayerType,
  type GameEvent,
  type MatchSession,
  type DataFilters,
  type HeatmapMode,
} from '@appTypes/telemetry';

import type {
  MatchSummary,
  HotZone,
  PlayerStats,
  DeadZone,
  BehaviorComparison,
  StormDeathAnalysis
} from '../types/stats';

// MAP_CONFIGS registry lives in coordinateMapper.ts.
// It starts empty and is populated at runtime by calibrateMapConfig().
// Import MAP_CONFIGS from '@utils/coordinateMapper' when you need it.

// ---------------------------------------------------------------------------
// Session assembly
// ---------------------------------------------------------------------------

export function assembleMatchSessions(events: GameEvent[]): MatchSession[] {
  if (events.length === 0) return [];

  // 1. Ensure events are sorted by timestamp (stable)
  const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);


  const matchGroups = new Map<string, GameEvent[]>();
  for (const ev of sorted) {
    if (!matchGroups.has(ev.matchId)) matchGroups.set(ev.matchId, []);
    matchGroups.get(ev.matchId)!.push(ev);
  }

  const sessions: MatchSession[] = [];

  for (const [matchId, matchEvents] of matchGroups.entries()) {
    const summary = getMatchSummary(matchEvents, matchId);
    
    // Allow all matches that have at least one event
    const isInvalid = matchEvents.length === 0;

    sessions.push({
      matchId,
      events:      matchEvents,
      startTime:   new Date(matchEvents[0].timestampMs),
      durationSeconds: summary.durationSeconds,
      humanCount:  summary.humanCount,
      botCount:    summary.botCount,
      totalKills:  summary.totalKills,
      isInvalid,
    });
  }

  // Filter out invalid sessions (test/bot matches)
  return sessions.filter(s => !s.isInvalid);
}

// ---------------------------------------------------------------------------
// Heatmap event selection
// ---------------------------------------------------------------------------

/** Event types shown in each HeatmapMode. */
const HEATMAP_EVENT_SETS: Record<HeatmapMode, ReadonlySet<EventType>> = {
  kills:   new Set([EventType.Kill, EventType.BotKill]),
  deaths:  new Set([EventType.Killed, EventType.BotKilled, EventType.KilledByStorm]),
  traffic: new Set([EventType.Position, EventType.BotPosition]),
};

/** Filter events to only those relevant for the given heatmap mode. */
export function filterForHeatmap(
  events: GameEvent[],
  mode: HeatmapMode,
): GameEvent[] {
  const allowed = HEATMAP_EVENT_SETS[mode];
  return events.filter(e => allowed.has(e.eventType));
}

// ---------------------------------------------------------------------------
// DataFilters pipeline
// ---------------------------------------------------------------------------

/** Apply all DataFilters to a flat event array. */
export function applyFilters(
  events: GameEvent[],
  filters: DataFilters,
): GameEvent[] {
  let result = events;

  if (filters.mapId !== null) {
    result = result.filter(e => e.mapId === filters.mapId);
  }

  if (filters.matchId !== null) {
    result = result.filter(e => e.matchId === filters.matchId);
  }

  if (filters.date !== null) {
    // ts is ms from match start; files are organised in dated folders.
    // The date filter works on the folder/file date injected at load time.
    // For now, filter by a `date` field if present — see parquetLoader for injection.
    result = result.filter(e => ('date' in e) && (e as unknown as { date: string }).date === filters.date);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Timeline helpers
// ---------------------------------------------------------------------------

/**
 * Filter events to those with timestampMs ≤ currentTimeMs.
 * Used by the timeline playback to progressively reveal events.
 */
export function filterByTimeline(events: GameEvent[], currentTimeMs: number): GameEvent[] {
  return events.filter(e => e.timestampMs <= currentTimeMs);
}

/** Return [minMs, maxMs] across all events. Returns [0, 0] for empty arrays. */
export function getTimeRange(events: GameEvent[]): [number, number] {
  if (events.length === 0) return [0, 0];
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    if (e.timestampMs < min) min = e.timestampMs;
    if (e.timestampMs > max) max = e.timestampMs;
  }
  return [min, max];
}

// ---------------------------------------------------------------------------
// Distinct value helpers (for filter dropdowns)
// ---------------------------------------------------------------------------

export function getDistinctMaps(events: GameEvent[]): MapId[] {
  return [...new Set(events.map(e => e.mapId))].sort() as MapId[];
}

export function getDistinctMatchIds(events: GameEvent[]): string[] {
  return [...new Set(events.map(e => e.matchId))].sort();
}

export function getDistinctDates(events: Array<GameEvent & { date?: string }>): string[] {
  return [...new Set(events.map(e => e.date ?? '').filter(Boolean))].sort();
}

// ---------------------------------------------------------------------------
// Analytical Functions
// ---------------------------------------------------------------------------

export function getMatchSummary(events: GameEvent[], matchId: string): MatchSummary {
  const humanIds = new Set<string>();
  const botIds = new Set<string>();
  let totalKills = 0;
  let totalDeaths = 0;
  let stormDeaths = 0;
  let lootEvents = 0;
  
  let startMs = Infinity;
  let endMs = -Infinity;

  for (const ev of events) {
    if (ev.matchId !== matchId) continue;
    
    if (ev.timestampMs < startMs) startMs = ev.timestampMs;
    if (ev.timestampMs > endMs) endMs = ev.timestampMs;

    if (ev.playerType === PlayerType.HUMAN) humanIds.add(ev.userId);
    else botIds.add(ev.userId);

    if (ev.eventType === EventType.Kill || ev.eventType === EventType.BotKill) totalKills++;
    if (ev.eventType === EventType.Killed || ev.eventType === EventType.BotKilled) totalDeaths++;
    if (ev.eventType === EventType.KilledByStorm) {
      totalDeaths++;
      stormDeaths++;
    }
    if (ev.eventType === EventType.Loot) lootEvents++;
  }

  const humanCount = humanIds.size;
  const botCount = botIds.size;
  const totalPlayers = humanCount + botCount;
  
  const durationSeconds = startMs <= endMs && startMs !== Infinity ? (endMs - startMs) / 1000 : 0;
  
  const lastSeenMs = new Map<string, number>();
  for (const ev of events) {
    if (ev.matchId !== matchId) continue;
    const current = lastSeenMs.get(ev.userId) ?? startMs;
    if (ev.timestampMs > current) lastSeenMs.set(ev.userId, ev.timestampMs);
  }
  
  let sumSurvivalMs = 0;
  for (const ms of lastSeenMs.values()) {
    sumSurvivalMs += (ms - startMs);
  }
  const avgSurvivalTimeSeconds = totalPlayers > 0 ? (sumSurvivalMs / totalPlayers) / 1000 : 0;
  const killsPerMinute = durationSeconds > 0 ? totalKills / (durationSeconds / 60) : 0;

  return {
    totalPlayers,
    humanCount,
    botCount,
    durationSeconds,
    totalKills,
    totalDeaths,
    stormDeaths,
    lootEvents,
    avgSurvivalTimeSeconds,
    killsPerMinute
  };
}

export function getHotZones(events: GameEvent[], eventType: EventType, gridSize = 50): HotZone[] {
  if (events.length === 0) return [];

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const ev of events) {
    if (ev.worldX < minX) minX = ev.worldX;
    if (ev.worldX > maxX) maxX = ev.worldX;
    if (ev.worldZ < minZ) minZ = ev.worldZ;
    if (ev.worldZ > maxZ) maxZ = ev.worldZ;
  }
  
  if (minX === Infinity) return [];

  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;
  const cellWidth = rangeX / gridSize;
  const cellHeight = rangeZ / gridSize;
  
  const grid = new Map<string, number>();
  let matchCount = 0;

  for (const ev of events) {
    if (ev.eventType !== eventType) continue;
    matchCount++;
    
    let cx = Math.floor((ev.worldX - minX) / cellWidth);
    let cz = Math.floor((ev.worldZ - minZ) / cellHeight);
    
    if (cx === gridSize) cx--;
    if (cz === gridSize) cz--;
    
    const key = `${cx},${cz}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  if (matchCount === 0) return [];

  const result: HotZone[] = [];
  for (const [key, count] of grid.entries()) {
    const [cx, cy] = key.split(',').map(Number);
    result.push({
      cellX: cx,
      cellY: cy,
      count,
      percentOfTotal: (count / matchCount) * 100
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export function getPlayerStats(events: GameEvent[], playerId: string): PlayerStats {
  let kills = 0;
  let deaths = 0;
  let lootCount = 0;
  let isBot = false;
  
  let startMs = Infinity;
  let lastSeenMs = -Infinity;
  
  let lastX = 0;
  let lastZ = 0;
  let hasLastPos = false;
  let distanceTraveledUnits = 0;

  for (const ev of events) {
    if (ev.userId !== playerId) continue;
    
    isBot = ev.playerType === PlayerType.BOT;
    
    if (ev.timestampMs < startMs) startMs = ev.timestampMs;
    if (ev.timestampMs > lastSeenMs) lastSeenMs = ev.timestampMs;

    if (ev.eventType === EventType.Kill || ev.eventType === EventType.BotKill) kills++;
    if (ev.eventType === EventType.Killed || ev.eventType === EventType.BotKilled || ev.eventType === EventType.KilledByStorm) deaths++;
    if (ev.eventType === EventType.Loot) lootCount++;
    
    if (ev.eventType === EventType.Position || ev.eventType === EventType.BotPosition) {
      if (hasLastPos) {
        const dx = ev.worldX - lastX;
        const dz = ev.worldZ - lastZ;
        distanceTraveledUnits += Math.sqrt(dx * dx + dz * dz);
      }
      lastX = ev.worldX;
      lastZ = ev.worldZ;
      hasLastPos = true;
    }
  }

  const survivalTimeSeconds = startMs <= lastSeenMs && startMs !== Infinity ? (lastSeenMs - startMs) / 1000 : 0;

  return {
    kills,
    deaths,
    lootCount,
    isBot,
    survivalTimeSeconds,
    distanceTraveledUnits
  };
}

export function getUnderusedAreas(events: GameEvent[], gridSize = 50, threshold = 0.05): DeadZone[] {
  if (events.length === 0) return [];
  
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const ev of events) {
    if (ev.worldX < minX) minX = ev.worldX;
    if (ev.worldX > maxX) maxX = ev.worldX;
    if (ev.worldZ < minZ) minZ = ev.worldZ;
    if (ev.worldZ > maxZ) maxZ = ev.worldZ;
  }
  
  if (minX === Infinity) return [];

  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;
  const cellWidth = rangeX / gridSize;
  const cellHeight = rangeZ / gridSize;
  
  const grid = new Map<string, number>();
  let totalEvents = 0;

  for (const ev of events) {
    totalEvents++;
    let cx = Math.floor((ev.worldX - minX) / cellWidth);
    let cz = Math.floor((ev.worldZ - minZ) / cellHeight);
    if (cx === gridSize) cx--;
    if (cz === gridSize) cz--;
    const key = `${cx},${cz}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  if (totalEvents === 0) return [];

  const result: DeadZone[] = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const count = grid.get(`${x},${y}`) || 0;
      const pct = (count / totalEvents) * 100;
      if (pct < threshold) {
        result.push({ cellX: x, cellY: y, percentOfTotal: pct });
      }
    }
  }

  return result;
}

export function getBotVsHumanBehavior(events: GameEvent[]): BehaviorComparison {
  if (events.length === 0) {
    return {
      humanAvgSurvivalSeconds: 0, botAvgSurvivalSeconds: 0,
      humanAvgKills: 0, botAvgKills: 0,
      humanAvgDistanceTraveled: 0, botAvgDistanceTraveled: 0
    };
  }

  const humanIds = new Set<string>();
  const botIds = new Set<string>();
  
  for (const ev of events) {
    if (ev.playerType === PlayerType.HUMAN) humanIds.add(ev.userId);
    else botIds.add(ev.userId);
  }
  
  let hSurvival = 0, hKills = 0, hDistance = 0;
  for (const id of humanIds) {
    const st = getPlayerStats(events, id);
    hSurvival += st.survivalTimeSeconds;
    hKills += st.kills;
    hDistance += st.distanceTraveledUnits;
  }
  
  let bSurvival = 0, bKills = 0, bDistance = 0;
  for (const id of botIds) {
    const st = getPlayerStats(events, id);
    bSurvival += st.survivalTimeSeconds;
    bKills += st.kills;
    bDistance += st.distanceTraveledUnits;
  }

  return {
    humanAvgSurvivalSeconds: humanIds.size > 0 ? hSurvival / humanIds.size : 0,
    botAvgSurvivalSeconds: botIds.size > 0 ? bSurvival / botIds.size : 0,
    humanAvgKills: humanIds.size > 0 ? hKills / humanIds.size : 0,
    botAvgKills: botIds.size > 0 ? bKills / botIds.size : 0,
    humanAvgDistanceTraveled: humanIds.size > 0 ? hDistance / humanIds.size : 0,
    botAvgDistanceTraveled: botIds.size > 0 ? bDistance / botIds.size : 0
  };
}

export function getStormDeathClusters(events: GameEvent[]): StormDeathAnalysis {
  if (events.length === 0) return { earlyStormDeaths: 0, lateStormDeaths: 0, hotspots: [] };
  
  const stormEvents = events.filter(e => e.eventType === EventType.KilledByStorm);
  
  if (stormEvents.length === 0) return { earlyStormDeaths: 0, lateStormDeaths: 0, hotspots: [] };

  const [minMs, maxMs] = getTimeRange(events);
  const duration = maxMs - minMs;
  const thresholdMs = minMs + (duration * 0.25);
  
  let early = 0;
  let late = 0;
  
  for (const ev of stormEvents) {
    if (ev.timestampMs <= thresholdMs) early++;
    else late++;
  }
  
  const hotspots = getHotZones(events, EventType.KilledByStorm);
  
  return { earlyStormDeaths: early, lateStormDeaths: late, hotspots };
}
