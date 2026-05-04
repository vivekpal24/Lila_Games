/**
 * parquetLoader.ts — In-browser data loading layer for LILA BLACK telemetry.
 *
 * Dataset is expected to be ~few MB per day file. In-browser parsing is appropriate
 * at this scale. If files exceed ~200MB, move aggregation to a backend endpoint and
 * serve pre-aggregated JSON instead of raw parquet.
 *
 * This is a frontend-only tool. Files are fetched from /public/data/ via
 * the browser's fetch API and parsed in-browser using hyparquet.
 * No backend. No server. Static files only.
 *
 * Why hyparquet and not apache-arrow?
 *   apache-arrow (JS) reads Arrow IPC format. These files are native Parquet format.
 *   hyparquet is a pure-JS Parquet reader (~60KB) with zero WASM dependency,
 *   making it ideal for browser use. apache-arrow is retained for type utilities.
 */

import { parquetRead } from 'hyparquet';
import {
  EventType,
  MapId,
  PlayerType,
  type GameEvent,
  type DataFilters,
  type MatchSession,
} from '@appTypes/telemetry';
import { assembleMatchSessions } from '@utils/statsEngine';

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

/**
 * One entry in manifest.json — describes a single parquet file.
 *
 * Generate manifest.json with:
 *   python scripts/generate_manifest.py player_data/ > public/data/manifest.json
 *
 * Or manually: list all files across February_10/ … February_14/ and build this JSON.
 */
export interface ManifestEntry {
  /** Calendar date of the session: 'YYYY-MM-DD' */
  readonly date:     string;
  /** Sub-folder name, e.g. 'February_10' */
  readonly folder:   string;
  /** Full relative path from /public/data/, e.g. 'February_10/uuid_matchid.nakama-0' */
  readonly path:     string;
  /** Raw user_id from the filename (before the first underscore split) */
  readonly userId:   string;
  /** Raw match_id from the filename (the UUID part, without .nakama-0) */
  readonly matchId:  string;
}

export interface DataManifest {
  /** ISO timestamp of when this manifest was generated */
  readonly generated:  string;
  readonly totalFiles: number;
  readonly entries:    ManifestEntry[];
}

import * as Comlink from 'comlink';
import type { ParquetWorkerAPI } from '../workers/parquetWorker';

// ---------------------------------------------------------------------------
// 1. loadParquetFile (with Fetch Timeout & Comlink Worker)
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404) {
      console.warn(`[parquetLoader] File not found: ${url}`);
      return new ArrayBuffer(0);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.arrayBuffer();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("Download timed out. Check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// Singleton Comlink Worker Proxy
let workerProxy: Comlink.Remote<ParquetWorkerAPI> | null = null;

function getWorkerProxy() {
  if (typeof Worker === 'undefined') return null; // No worker support
  if (!workerProxy) {
    const worker = new Worker(new URL('../workers/parquetWorker', import.meta.url), { type: 'module' });
    workerProxy = Comlink.wrap<ParquetWorkerAPI>(worker);
  }
  return workerProxy;
}

export async function loadParquetFile(
  url: string, 
  onProgress?: (percent: number) => void,
  retryCount = 0
): Promise<GameEvent[]> {
  try {
    const buffer = await fetchWithTimeout(url, 30000);
    if (buffer.byteLength === 0) return []; // 404 handled gracefully
    
    const proxy = getWorkerProxy();
    if (proxy) {
      return await proxy.parseBuffer(buffer, onProgress ? Comlink.proxy(onProgress) : () => {});
    } else {
      // FALLBACK: Parse on main thread if Workers are unsupported
      console.warn('[parquetLoader] Web Workers not supported, falling back to main-thread parsing.');
      const { workerAPI } = await import('../workers/parquetWorker');
      return await workerAPI.parseBuffer(buffer, onProgress || (() => {}));
    }
  } catch (err: any) {
    if (retryCount < 2) {
      console.warn(`[parquetLoader] Error loading ${url}. Retrying (${retryCount + 1}/2)...`);
      workerProxy = null; 
      return loadParquetFile(url, onProgress, retryCount + 1);
    }
    
    console.error(`[parquetLoader] Failed after 2 retries:`, err);
    throw err; 
  }
}

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

let manifestCache: DataManifest | null = null;

async function loadManifest(): Promise<DataManifest> {
  if (manifestCache) return manifestCache;

  const response = await fetch('/data/manifest.json');
  if (!response.ok) {
    throw new Error(
      `[parquetLoader] Could not load /data/manifest.json (HTTP ${response.status}). ` +
      `Generate it with: python scripts/generate_manifest.py`,
    );
  }

  manifestCache = (await response.json()) as DataManifest;
  console.info(
    `[parquetLoader] Manifest loaded: ${manifestCache.totalFiles} files, ` +
    `generated ${manifestCache.generated}`,
  );
  return manifestCache;
}

/**
 * Get a unique list of dates (YYYY-MM-DD) present in the manifest,
 * sorted chronologically ascending.
 */
export async function getAvailableDates(): Promise<string[]> {
  const manifest = await loadManifest();
  const dates = new Set(manifest.entries.map(e => e.date));
  return Array.from(dates).sort();
}

/** Map a 'YYYY-MM-DD' date string to the folder name used in /public/data/. */
function dateToFolder(date: string): string {
  const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const [, , mm, dd] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const month = MONTH_NAMES[parseInt(mm ?? '0', 10)] ?? 'Unknown';
  const day   = parseInt(dd ?? '0', 10);
  return `${month}_${day}`;
}

// ---------------------------------------------------------------------------
// 3. loadAllData
// ---------------------------------------------------------------------------

/**
 * Load all parquet files matching the given filters, parse them, group by
 * match_id into MatchSession[], and return sorted by startTime ascending.
 *
 * @param filters    - Map, date, and match filters (nulls = no filter)
 * @param onProgress - Optional callback: called with 0–100 as batches complete
 */
export async function loadAllData(
  filters: DataFilters,
  onProgress?: (pct: number) => void,
): Promise<MatchSession[]> {
  onProgress?.(5);

  const manifest = await loadManifest();
  let entries = manifest.entries || [];

  // Filter by Date (if selected)
  if (filters.date !== null) {
    const targetFolder = dateToFolder(filters.date);
    entries = entries.filter(e => e.folder === targetFolder);
  }

  // NOTE: We do NOT filter by mapId here because ManifestEntry does not 
  // contain mapId. Map filtering happens in the assembly step below.

  // NOTE: We also do NOT filter by matchId here. 
  // Doing so would cause the loaded dataset to only contain one match,
  // which breaks the TopBar dropdown options. All matches for the date are loaded.

  if (entries.length === 0) {
    onProgress?.(100);
    return [];
  }

  const allEvents: GameEvent[] = [];
  const total = entries.length;
  let completed = 0;
  const fileProgress = new Map<string, number>();

  const CONCURRENCY = 3;
  let i = 0;

  const updateOverallProgress = () => {
    let sum = 0;
    for (const pct of fileProgress.values()) sum += pct;
    const overall = 15 + Math.round((sum / (total * 100)) * 85);
    onProgress?.(overall);
  };

  while (i < total) {
    const chunk = entries.slice(i, i + CONCURRENCY);
    
    const chunkPromises = chunk.map(async entry => {
      const url = `/data/${entry.path}`;
      fileProgress.set(url, 0);
      
      const events = await loadParquetFile(url, (pct) => {
        fileProgress.set(url, pct);
        updateOverallProgress();
      });

      const dated = events.map(ev =>
        Object.assign(Object.create(null) as object, ev, { date: entry.date }),
      ) as GameEvent[];

      allEvents.push(...dated);
      completed++;
      fileProgress.set(url, 100);
      updateOverallProgress();
    });
    
    await Promise.all(chunkPromises);
    i += CONCURRENCY;
  }

  // DIAGNOSTIC: Log found map IDs before filtering
  const foundMaps = new Set(allEvents.map(e => e.mapId));
  console.info(`[parquetLoader] Found maps in loaded data:`, Array.from(foundMaps));

  const filtered = filters.mapId !== null
    ? allEvents.filter(ev => ev.mapId === filters.mapId)
    : allEvents;

  const sessions = assembleMatchSessions(filtered);

  sessions.sort((a, b) => {
    const aMs = a.startTime?.getTime() ?? Infinity;
    const bMs = b.startTime?.getTime() ?? Infinity;
    return aMs - bMs;
  });

  return sessions;
}
