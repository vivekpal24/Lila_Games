/// <reference lib="webworker" />

import * as Comlink from 'comlink';
import { parquetReadObjects } from 'hyparquet';
import { EventType, MapId, PlayerType, type GameEvent } from '../types/telemetry';

const COL = {
  USER_ID:  'user_id',
  MATCH_ID: 'match_id',
  MAP_ID:   'map_id',
  X:        'x',
  Y:        'y',
  Z:        'z',
  TS:       'ts',
  EVENT:    'event',
} as const;

export function detectPlayerType(userId: string): PlayerType {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(userId)) return PlayerType.HUMAN;
  if (/^\d+$/.test(userId)) return PlayerType.BOT;
  return PlayerType.HUMAN;
}

const TEXT_DECODER = new TextDecoder('utf-8');

function decodeBytes(value: unknown): string {
  if (value instanceof Uint8Array) return TEXT_DECODER.decode(value);
  if (typeof value === 'string')   return value;
  if (value !== null && typeof value === 'object' && 'buffer' in value) {
    return TEXT_DECODER.decode(value as Uint8Array);
  }
  return '';
}

function parseTimestamp(value: unknown): number {
  let num = 0;
  if (typeof value === 'bigint') num = Number(value);
  else if (typeof value === 'number') num = value;
  else if (value instanceof Date) num = value.getTime();
  else if (typeof value === 'string') {
    const d = new Date(value);
    num = isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // Heuristic: If timestamp is < 10^12, it's likely in seconds (Unix epoch for 2026 is ~1.7e9)
  // 10^12 is the cutoff where ms timestamps started (around year 2001)
  if (num > 0 && num < 1_000_000_000_000) {
    return num * 1000;
  }
  return num;
}

function parseCoord(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!isFinite(n)) return null;
  return n;
}

function parseEventType(raw: string): EventType | null {
  switch (raw) {
    case 'Position':      return EventType.Position;
    case 'BotPosition':   return EventType.BotPosition;
    case 'Kill':          return EventType.Kill;
    case 'Killed':        return EventType.Killed;
    case 'BotKill':       return EventType.BotKill;
    case 'BotKilled':     return EventType.BotKilled;
    case 'KilledByStorm': return EventType.KilledByStorm;
    case 'Loot':          return EventType.Loot;
    default:              return null;
  }
}

function parseMapId(raw: string): MapId {
  const normalized = raw.trim().toLowerCase();
  
  if (normalized.includes('ambrose')) return MapId.AMBROSE_VALLEY;
  if (normalized.includes('rift'))    return MapId.GRAND_RIFT;
  if (normalized.includes('lockdown')) return MapId.LOCKDOWN;
  
  console.warn(`[parquetWorker] Unrecognized map_id in data: "${raw}" — defaulting to AmbroseValley`);
  return MapId.AMBROSE_VALLEY; 
}

function rowToGameEvent(row: Record<string, unknown>, rowIndex: number): GameEvent | null {
  const worldX = parseCoord(row[COL.X]);
  const worldZ = parseCoord(row[COL.Z]);

  if (worldX === null || worldZ === null) {
    console.warn(`[parquetWorker] Row ${rowIndex} skipped: null/invalid coordinates (X=${row[COL.X]}, Z=${row[COL.Z]})`);
    return null;
  }

  const eventStr  = decodeBytes(row[COL.EVENT]);
  const eventType = parseEventType(eventStr);
  if (!eventType) {
    if (eventStr) console.warn(`[parquetWorker] Row ${rowIndex} skipped: unrecognized event type "${eventStr}"`);
    return null;
  }

  const mapId = parseMapId(decodeBytes(row[COL.MAP_ID]));
  let userId = String(row[COL.USER_ID] ?? '').trim();
  
  if (!userId) {
    userId = `unknown_player_${rowIndex}`;
    console.warn(`[parquetWorker] Row ${rowIndex}: empty user_id, assigned "${userId}"`);
  }

  const base = {
    userId:      decodeBytes(row[COL.USER_ID]).trim(),
    matchId:     decodeBytes(row[COL.MATCH_ID] ?? ''),
    mapId,
    worldX,
    elevation:   parseCoord(row[COL.Y]) ?? 0,
    worldZ,
    timestampMs: parseTimestamp(row[COL.TS]),
    playerType:  detectPlayerType(userId),
  } as const;

  switch (eventType) {
    case EventType.Position:      return { ...base, eventType: EventType.Position };
    case EventType.BotPosition:   return { ...base, eventType: EventType.BotPosition };
    case EventType.Kill:          return { ...base, eventType: EventType.Kill };
    case EventType.Killed:        return { ...base, eventType: EventType.Killed };
    case EventType.BotKill:       return { ...base, eventType: EventType.BotKill };
    case EventType.BotKilled:     return { ...base, eventType: EventType.BotKilled };
    case EventType.KilledByStorm: return { ...base, eventType: EventType.KilledByStorm };
    case EventType.Loot:          return { ...base, eventType: EventType.Loot };
  }
}

const workerAPI = {
  async parseBuffer(buffer: ArrayBuffer, onProgress: (percent: number) => void): Promise<GameEvent[]> {
    try {
      const rows = await parquetReadObjects({
        file: buffer,
      });

      const events: GameEvent[]  = [];
      const seen  = new Set<string>();

      // Send initial progress
      onProgress(10);

      const totalRows = rows.length;
      if (totalRows === 0) {
        onProgress(100);
        return [];
      }

      for (let i = 0; i < totalRows; i++) {
        const event = rowToGameEvent(rows[i], i);
        if (!event) continue;

        // Composite key for duplicate detection
        const key = `${event.userId}|${event.matchId}|${event.timestampMs}|${event.eventType}`;
        if (seen.has(key)) continue;
        seen.add(key);

        events.push(event);

        if (i % 50000 === 0) {
          onProgress(10 + Math.floor((i / totalRows) * 80)); // 10% to 90%
        }
      }

      // Stable sort by timestamp (preserve original order for identical timestamps)
      events.sort((a, b) => a.timestampMs - b.timestampMs);
      
      onProgress(100);

      return events;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }
};

Comlink.expose(workerAPI);

export type ParquetWorkerAPI = typeof workerAPI;
