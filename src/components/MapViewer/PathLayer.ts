/**
 * PathLayer.ts — PathLayer for player movement trails.
 *
 * FIXES ISSUE #8: Movement data is sampled at 1-second intervals for smooth playback.
 * Raw event density can be thousands of points/second which causes visible lag.
 * This tradeoff prioritizes smooth UX over perfect fidelity.
 *
 * Selected player: full color, full opacity.
 * All other human players: same hue hash, opacity 0.15.
 * Bots: hidden unless showBots is true.
 */

import { useMemo, useCallback }    from 'react';
import { PathLayer }  from '@deck.gl/layers';
import { EventType, PlayerType, type GameEvent } from '@appTypes/telemetry';
import { worldToPixel, type MapConfig } from '@utils/coordinateMapper';
import { useAppStore } from '@store/appStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerPath {
  playerId:   string;
  playerType: PlayerType;
  positions:  [number, number][];   // pixel coords
  isSelected: boolean;
}

type RGBA = [number, number, number, number];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** Deterministically hash a playerId string to a hue (avoiding red/yellow/orange). 
 * Maps to the 160 (Cyan) to 280 (Purple) range. 
 */
function playerHue(playerId: string): number {
  let h = 0;
  for (let i = 0; i < playerId.length; i++) {
    h = Math.imul(31, h) + playerId.charCodeAt(i) | 0;
  }
  // Map to 160-280 range (Blue/Cyan/Purple)
  return 160 + (Math.abs(h) % 120);
}

function playerColor(playerId: string, opacity: number): RGBA {
  const [r, g, b] = hslToRgb(playerHue(playerId), 0.75, 0.55);
  return [r, g, b, Math.round(opacity * 255)];
}

// ---------------------------------------------------------------------------
// Sampling (1-second interval — Issue #8 fix)
// ---------------------------------------------------------------------------

const MOVEMENT_TYPES = new Set<EventType>([
  EventType.Position,
  EventType.BotPosition,
]);

const SAMPLE_MS = 1_000;

function samplePath(
  events: GameEvent[],
  playerId: string,
  cutoffMs: number,
): [number, number][] {
  // Filter to this player's movement events within the playback window
  const moves = events.filter(
    e => e.userId === playerId && MOVEMENT_TYPES.has(e.eventType) && e.timestampMs <= cutoffMs,
  );
  if (moves.length === 0) return [];

  const positions: [number, number][] = [];
  let lastMs = -Infinity;

  for (let i = 0; i < moves.length; i++) {
    const ev = moves[i];
    const isLast = i === moves.length - 1;
    if (isLast || ev.timestampMs - lastMs >= SAMPLE_MS) {
      positions.push([ev.worldX, ev.worldZ]);
      lastMs = ev.timestampMs;
    }
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePathLayer(
  events: GameEvent[],
  config: MapConfig | null,
): PathLayer<PlayerPath> | null {
  const playbackTime      = useAppStore(s => s.playbackTime);
  const selectedPlayerId  = useAppStore(s => s.selectedPlayerId);
  const showBots          = useAppStore(s => s.showBots);
  const showMovementPaths = useAppStore(s => s.showMovementPaths);
  const selectedMatchId   = useAppStore(s => s.selectedMatchId);

  const pathData = useMemo<PlayerPath[]>(() => {
    if (!config || events.length === 0) return [];
    
    // Filter for current match only
    const matchEvents = events.filter(ev => ev.matchId === selectedMatchId);
    if (matchEvents.length === 0) return [];

    const startMs  = matchEvents[0].timestampMs;
    const cutoffMs = startMs + (playbackTime * 1_000);

    // Collect distinct players from movement events
    const playerSet = new Map<string, PlayerType>();
    for (const ev of matchEvents) {
      if (MOVEMENT_TYPES.has(ev.eventType)) {
        playerSet.set(ev.userId, ev.playerType);
      }
    }

    const paths: PlayerPath[] = [];

    for (const [playerId, playerType] of playerSet) {
      if (playerType === PlayerType.BOT && !showBots) continue;

      const rawPositions = samplePath(matchEvents, playerId, cutoffMs);
      if (rawPositions.length < 2) continue;  // need at least 2 points for a path

      // Convert world coords to pixel coords
      const positions = rawPositions.map(([wx, wz]): [number, number] => {
        const { px, py } = worldToPixel(wx, wz, config);
        return [px, py];
      });

      paths.push({
        playerId,
        playerType,
        positions,
        isSelected: playerId === selectedPlayerId,
      });
    }

    return paths;
  }, [events, selectedMatchId, playbackTime, selectedPlayerId, showBots, config]);

  const getPath = useCallback((d: PlayerPath) => d.positions, []);
  
  const getColor = useCallback((d: PlayerPath) => 
    playerColor(d.playerId, d.isSelected ? 1.0 : 0.8),
  []);

  return useMemo(() => {
    if (!showMovementPaths || pathData.length === 0) return null;

    return new PathLayer<PlayerPath>({
      id:   'player-paths',
      data: pathData,

      getPath:  getPath,
      getColor: getColor,

      getWidth:           4,
      widthUnits:         'pixels',
      widthMinPixels:     2,

      // Selected player path is wider and fully opaque
      updateTriggers: {
        getColor: [selectedPlayerId],
        getWidth: [selectedPlayerId],
      },
    });
  }, [pathData, selectedPlayerId, getPath, getColor]);
}
