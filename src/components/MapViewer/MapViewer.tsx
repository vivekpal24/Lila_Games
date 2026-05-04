/**
 * MapViewer.tsx — DeckGL + OrthographicView shell for LILA BLACK map data.
 */

import { useMemo, useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import type { MapConfig } from '@utils/coordinateMapper';
import type { MatchSession } from '@appTypes/telemetry';
import { useAppStore, useVisibleEvents } from '@store/appStore';

import { buildMinimapLayer } from './MinimapLayer';
import { useEventLayers }    from './EventLayer';
import { usePathLayer }      from './PathLayer';
import { useHeatmapLayer }   from './HeatmapLayer';
import { usePlayerLayer }    from './PlayerLayer';

// Silence luma.gl and loaders noise
const orgWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && (args[0].includes('weightsTexture') || args[0].includes('Loader'))) return;
  orgWarn.apply(console, args);
};

export interface MapViewerProps {
  sessions:  MatchSession[];
  mapConfig: MapConfig | null;
  imageUrl:  string;
}

export function MapViewer({ sessions, mapConfig, imageUrl }: MapViewerProps) {
  // Selective subscriptions to avoid re-rendering on every store change
  const selectedPlayerId = useAppStore(s => s.selectedPlayerId);
  const hoverEvent        = useAppStore(s => s.hoverEvent);
  const selectPlayer     = useAppStore(s => s.selectPlayer);

  const [imageFailed, setImageFailed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Track zoom level for clustering
  const [currentZoom, setCurrentZoom] = useState(0);

  // Pre-load image
  useEffect(() => {
    if (!mapConfig) return;
    setImageFailed(false);
    setMapLoaded(false);

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setMapLoaded(true);
    };
    img.onerror = () => {
      setImageFailed(true);
      setMapLoaded(true);
    };
  }, [imageUrl, mapConfig]);

  // Aggregate all events
  const allEvents = useMemo(() => sessions.flatMap(s => s.events), [sessions]);
  const visibleEvents = useVisibleEvents(allEvents);

  const initialViewState = useMemo(() => {
    if (!mapConfig) return null;
    const minZoomLevel = Math.log2(window.innerWidth / mapConfig.imageWidth) - 0.5;
    return {
      target:  [mapConfig.imageWidth / 2, mapConfig.imageHeight / 2, 0] as [number, number, number],
      zoom:    minZoomLevel,
      minZoom: minZoomLevel, 
      maxZoom: 5,
    };
  }, [mapConfig]);

  // Sync zoom level once view state is stable
  useEffect(() => {
    if (initialViewState) {
      setCurrentZoom(initialViewState.zoom);
    }
  }, [initialViewState]);

  // ── Layers ────────────────────────────────────────────────────────────────
  const minimapLayers = mapConfig ? buildMinimapLayer(imageUrl, mapConfig, imageFailed) : [];
  const eventLayerResult = useEventLayers(visibleEvents, mapConfig, selectedPlayerId, currentZoom);
  const pathLayer = usePathLayer(allEvents, mapConfig);
  const heatmapLayer = useHeatmapLayer(allEvents, mapConfig);
  const playerLayer = usePlayerLayer(allEvents, mapConfig);

  const layers = [
    ...minimapLayers,
    heatmapLayer,
    pathLayer,
    playerLayer,
    ...(eventLayerResult?.layers || [])
  ].filter((l): l is any => l !== null);

  // ── Calibrating State ─────────────────────────────────────────────────────
  if (!mapConfig || !initialViewState) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-white" />
          <p className="mt-4 text-sm font-medium">Calibrating coordinate map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      <div className={`absolute inset-0 transition-opacity duration-200 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <DeckGL
          initialViewState={initialViewState}
          controller={true}
          views={new OrthographicView({ id: 'ortho' })}
          layers={layers}
          onError={(error: any) => {
            if (error.message?.includes('weightsTexture')) return;
            console.error('[deck.gl] Error:', error);
          }}
          onViewStateChange={({ viewState }) => {
            if (typeof viewState.zoom === 'number') {
              setCurrentZoom(viewState.zoom);
            }
          }}
          onHover={(info) => {
            // FIX: Access 'event' directly from the object instead of 'properties'
            const ev = info.object?.event;
            if (ev) {
              const eventId = `${ev.userId}|${ev.matchId}|${ev.timestampMs}|${ev.eventType}`;
              hoverEvent(eventId);
            } else {
              hoverEvent(null);
            }
          }}
          onClick={(info) => {
            // FIX: Access 'event' directly from the object instead of 'properties'
            const ev = info.object?.event;
            if (ev) {
              selectPlayer(ev.userId);
            } else if (info.object?.userId) {
              // Fallback for PlayerLayer which might just have userId
              selectPlayer(info.object.userId);
            } else {
              selectPlayer(null);
            }
          }}
          getCursor={({ isDragging, isHovering }) =>
            isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
          }
        />
      </div>

      {imageFailed && (
        <div className="absolute top-0 w-full bg-red-600 px-4 py-2 text-center text-sm font-bold text-white shadow-md z-10">
          Minimap image failed to load — showing coordinate grid
        </div>
      )}

      {allEvents.length === 0 && mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-black/80 px-6 py-4 rounded-lg text-white font-medium shadow-2xl backdrop-blur-sm">
            No events match this selection
          </div>
        </div>
      )}

      {/* ISSUE #2: Performance Guard Warning */}
      {eventLayerResult?.sampled && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 rounded-md bg-yellow-500/90 px-4 py-2 text-sm font-bold text-yellow-950 shadow-lg pointer-events-none z-10">
          ⚠️ Large match — rendering sampled view (30k of {eventLayerResult.total} events)
        </div>
      )}
    </div>
  );
}
