/**
 * App.tsx — Lila Viz application shell
 *
 * This is a pure client-side tool. No backend. Parquet files are static assets.
 * All parsing, coordinate mapping, and rendering happen in the browser.
 */

import './index.css';

import { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '@store/appStore';
import { useGameData } from './hooks/useGameData';
import { calibrateMapConfig, MAP_CONFIGS } from '@utils/coordinateMapper';
import type { MapConfig } from '@utils/coordinateMapper';

import { MapViewer } from '@components/MapViewer/MapViewer';
import { TopBar } from '@components/Layout/TopBar';
import { Sidebar } from '@components/Layout/Sidebar';
import { PlayerDetail } from '@components/PlayerDetail/PlayerDetail';
import { Timeline } from '@components/Timeline/Timeline';
import { ErrorBoundary } from '@components/ErrorBoundary/ErrorBoundary';


function AppContent() {
  const selectedMapId   = useAppStore(s => s.selectedMapId);
  const selectedDate    = useAppStore(s => s.selectedDate);
  const selectedMatchId = useAppStore(s => s.selectedMatchId);
  const setMatchDuration = useAppStore(s => s.setMatchDuration);

  const filters = useMemo(() => ({
    mapId: selectedMapId,
    date: selectedDate,
    matchId: selectedMatchId,
  }), [selectedMapId, selectedDate, selectedMatchId]);

  const fetchFilters = useMemo(() => ({
    mapId: selectedMapId,
    date: selectedDate,
    matchId: null, // explicitly null so useGameData fetches all matches
  }), [selectedMapId, selectedDate]);

  const { sessions, loading, progress, error, retry } = useGameData(fetchFilters);

  // Update match duration in store whenever sessions change
  useEffect(() => {
    const activeSessions = selectedMatchId ? sessions.filter(s => s.matchId === selectedMatchId) : sessions;
    if (activeSessions.length > 0) {
      const maxDur = Math.max(...activeSessions.map(s => s.durationSeconds));
      setMatchDuration(maxDur);
    } else {
      setMatchDuration(0);
    }
  }, [sessions, selectedMatchId]);

  // Current session logic for sidebar & player detail
  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    if (selectedMatchId) {
      return sessions.find(s => s.matchId === selectedMatchId) || sessions[0];
    }
    return sessions[0]; // fallback to first available
  }, [sessions, selectedMatchId]);

  // Coordinate map calibration
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [resolvedMapUrl, setResolvedMapUrl] = useState<string | null>(null);
  const setFilter = useAppStore(s => s.setFilter);

  // ISSUE A: Auto-select most recent date and first map on mount
  useEffect(() => {
    import('@utils/parquetLoader').then(({ getAvailableDates }) => {
      getAvailableDates().then(dates => {
        if (dates.length > 0 && !selectedDate) {
          setFilter('selectedDate', dates[dates.length - 1]);
        }
        if (!selectedMapId) {
          setFilter('selectedMapId', 'AmbroseValley' as any);
        }
      });
    });
  }, [selectedDate, selectedMapId, setFilter]);

  // ISSUE A: Auto-select first match when data loads
  useEffect(() => {
    if (sessions.length > 0 && !selectedMatchId) {
      setFilter('selectedMatchId', sessions[0].matchId);
    }
  }, [sessions, selectedMatchId, setFilter]);

  useEffect(() => {
    // ISSUE B: Guard against double-calibration
    if (MAP_CONFIGS[selectedMapId!] && mapConfig?.mapId === selectedMapId) return;

    // Only calibrate if we have sessions and a selected map
    // If no map selected, we can't reliably calibrate one map config
    if (sessions.length > 0 && selectedMapId) {
      // Gather all events for calibration
      const allEvents = sessions.flatMap(s => s.events);
      if (allEvents.length === 0) return;

      const img = new Image();
      // Heuristic: try .png first, then .jpg
      const tryLoad = (ext: string) => {
        img.src = `/assets/maps/${selectedMapId}.${ext}`;
        
        img.onload = () => {
          // Scan ALL events for this map to find absolute world boundaries
          const mapEvents = sessions.flatMap(s => s.events).filter(ev => ev.mapId === selectedMapId);
          const config = calibrateMapConfig(mapEvents, selectedMapId!, img);
          setMapConfig(config);
          setResolvedMapUrl(img.src);
        };
        
        img.onerror = () => {
          if (ext === 'png') {
            tryLoad('jpg');
          } else {
            console.warn(`[App] Failed to load minimap image for ${selectedMapId}.`);
            // Fallback config without image dimensions
            const config = calibrateMapConfig(allEvents, selectedMapId!, { width: 1000, height: 1000 } as HTMLImageElement);
            setMapConfig(config);
          }
        };
      };
      
      tryLoad('png');
    } else {
      setMapConfig(null);
    }
  }, [sessions, selectedMapId]);

  // Data validation banner
  const [dataWarning, setDataWarning] = useState<string | null>(null);

  useEffect(() => {
    if (sessions.length === 0) {
      setDataWarning(null);
      return;
    }

    const allEvents = sessions.flatMap(s => s.events);
    if (allEvents.length === 0) return;

    let validCoords = 0;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let hasRecognizedEvent = false;

    for (const ev of allEvents) {
      if (ev.worldX !== null && !isNaN(ev.worldX) && ev.worldZ !== null && !isNaN(ev.worldZ)) {
        validCoords++;
        if (ev.worldX < minX) minX = ev.worldX;
        if (ev.worldX > maxX) maxX = ev.worldX;
        if (ev.worldZ < minZ) minZ = ev.worldZ;
        if (ev.worldZ > maxZ) maxZ = ev.worldZ;
      }
      if (ev.eventType) hasRecognizedEvent = true;
    }

    const pctValid = validCoords / allEvents.length;
    const isAllZeroRange = minX !== Infinity && (maxX - minX === 0) && (maxZ - minZ === 0);

    if (pctValid < 0.8 || isAllZeroRange || !hasRecognizedEvent) {
      setDataWarning("⚠️ Data quality issues detected. Some events may not display correctly.");
    } else {
      setDataWarning(null);
    }
  }, [sessions]);

  return (
    <div className="relative h-screen w-screen bg-gray-900 overflow-hidden text-white font-sans selection:bg-orange-500/30">
      
      {/* ── Background Map Canvas ── */}
      <div className="absolute inset-0 z-0">
        {selectedMapId ? (
          sessions.length > 0 ? (
            <ErrorBoundary fallback="Map failed to render — try reloading">
              <MapViewer 
                sessions={selectedMatchId ? sessions.filter(s => s.matchId === selectedMatchId) : sessions}
                mapConfig={mapConfig}
                imageUrl={resolvedMapUrl || `/assets/maps/${selectedMapId}.png`}
              />
            </ErrorBoundary>
          ) : !loading && (
            <div className="flex h-full w-full items-center justify-center text-gray-500 flex-col gap-4">
              <div className="text-xl tracking-widest uppercase">LILA<span className="text-orange-500 font-bold">VIZ</span></div>
              <p>No matches found for this selection.</p>
              <p className="text-xs text-gray-600">Try changing the date or clearing filters.</p>
            </div>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500 flex-col gap-4">
            <div className="text-xl tracking-widest uppercase">LILA<span className="text-orange-500 font-bold">VIZ</span></div>
            <p>Select a Map and Date to begin analysis.</p>
          </div>
        )}
      </div>

      {/* ── Global Loading Overlay ── */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center max-w-sm w-full gap-4">
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm font-medium tracking-wide">Loading Parquet Data ({progress}%)...</p>
          </div>
        </div>
      )}

      {/* ── Error Overlay ── */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-900/95 text-red-100 px-6 py-4 rounded-lg border border-red-700 shadow-2xl backdrop-blur-md flex flex-col items-center gap-3">
          <div className="flex flex-col text-center">
            <h3 className="font-bold mb-1">Data loading failed.</h3>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={retry} className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-sm font-bold transition-colors shadow">
            [Retry]
          </button>
        </div>
      )}

      {/* ── Data Quality Warning ── */}
      {dataWarning && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-yellow-900/90 text-yellow-100 px-6 py-3 rounded-lg border border-yellow-700 shadow-xl backdrop-blur-md pointer-events-none">
          <p className="text-sm font-medium">{dataWarning}</p>
        </div>
      )}

      {/* ── UI Layer ── */}
      <TopBar sessions={sessions} />
      
      <ErrorBoundary fallback="Stats unavailable">
        <Sidebar currentSession={currentSession} />
      </ErrorBoundary>
      
      <ErrorBoundary fallback="Player details unavailable">
        <PlayerDetail currentSession={currentSession} />
      </ErrorBoundary>
      
      <ErrorBoundary fallback="Timeline unavailable">
        <Timeline />
      </ErrorBoundary>

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
