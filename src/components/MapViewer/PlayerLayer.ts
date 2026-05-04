/**
 * PlayerLayer.ts — Renders the CURRENT position of every player as a pulse/dot.
 * This ensures the map doesn't look empty at 0:00.
 */

import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { PlayerType, type GameEvent } from '@appTypes/telemetry';
import { worldToPixel, type MapConfig } from '@utils/coordinateMapper';
import { useAppStore } from '@store/appStore';

export function usePlayerLayer(
  allEvents: GameEvent[],
  config: MapConfig | null
) {
  const playbackTime     = useAppStore(s => s.playbackTime);
  const selectedPlayerId = useAppStore(s => s.selectedPlayerId);
  const showBots         = useAppStore(s => s.showBots);

  return useMemo(() => {
    if (!config || allEvents.length === 0) return null;

    const cutoffMs = (allEvents[0]?.timestampMs || 0) + (playbackTime * 1000);
    
    // 1. Find the VERY FIRST position for EVERY player in the entire match
    const spawnPositions = new Map<string, GameEvent>();
    for (const ev of allEvents) {
      if (ev.eventType !== 'Position' && ev.eventType !== 'BotPosition') continue;
      if (!spawnPositions.has(ev.userId)) {
        spawnPositions.set(ev.userId, ev);
      }
    }

    // 2. Find the LATEST position up to the current cutoff
    const latestPositions = new Map<string, GameEvent>();
    for (const ev of allEvents) {
      if (ev.timestampMs > cutoffMs) continue;
      if (ev.eventType !== 'Position' && ev.eventType !== 'BotPosition') continue;
      
      const existing = latestPositions.get(ev.userId);
      if (!existing || ev.timestampMs > existing.timestampMs) {
        latestPositions.set(ev.userId, ev);
      }
    }

    const data = Array.from(spawnPositions.values())
      .filter(ev => showBots || ev.playerType !== PlayerType.BOT)
      .map(ev => {
        // Find ALL positions for this player in ascending order
        const pMoves = allEvents.filter(e => 
          e.userId === ev.userId && 
          (e.eventType === 'Position' || e.eventType === 'BotPosition')
        );

        // Find the move immediately BEFORE and AFTER the cutoff
        let prev = pMoves[0];
        let next = pMoves[0];

        for (let i = 0; i < pMoves.length; i++) {
          if (pMoves[i].timestampMs <= cutoffMs) {
            prev = pMoves[i];
          } else {
            next = pMoves[i];
            break;
          }
        }

        let displayX = prev.worldX;
        let displayZ = prev.worldZ;
        let isWaiting = prev.timestampMs > cutoffMs;

        // Interpolate if we are between two points
        if (prev !== next && prev.timestampMs < cutoffMs && next.timestampMs > cutoffMs) {
          const ratio = (cutoffMs - prev.timestampMs) / (next.timestampMs - prev.timestampMs);
          displayX = prev.worldX + (next.worldX - prev.worldX) * ratio;
          displayZ = prev.worldZ + (next.worldZ - prev.worldZ) * ratio;
          isWaiting = false;
        }

        const { px, py } = worldToPixel(displayX, displayZ, config);
        return {
          position: [px, py],
          userId: ev.userId,
          isHuman: ev.playerType === PlayerType.HUMAN,
          isSelected: ev.userId === selectedPlayerId,
          isWaiting,
          event: prev
        };
      });

    return new ScatterplotLayer({
      id: 'player-current-positions',
      data,
      getPosition: (d: any) => d.position,
      getFillColor: (d: any) => {
        const base = d.isHuman ? [255, 255, 255] : [150, 150, 150];
        const opacity = d.isWaiting ? 60 : 255;
        return [...base, opacity] as [number, number, number, number];
      },
      getRadius: (d: any) => (d.isSelected ? 12 : 8),
      radiusUnits: 'pixels',
      stroked: true,
      getLineColor: (d: any) => [0, 0, 0, d.isWaiting ? 40 : 255] as [number, number, number, number],
      lineWidthMinPixels: 1,
      pickable: true
    });
  }, [allEvents, playbackTime, config, selectedPlayerId, showBots]);
}
