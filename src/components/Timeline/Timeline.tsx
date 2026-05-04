import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Keyboard } from 'lucide-react';
import { useAppStore, type PlaybackSpeed } from '@store/appStore';

export function Timeline() {
  const store = useAppStore();
  const lastUpdateRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // 1. Edge Case: NaN recovery
  useEffect(() => {
    if (isNaN(store.playbackTime)) {
      store.setPlaybackTime(0);
    }
  }, [store.playbackTime, store.setPlaybackTime]);

  // 2. Edge Case: Switching matches
  useEffect(() => {
    // appStore.setFilter already resets playbackTime to 0, but we need to pause
    if (useAppStore.getState().isPlaying) {
      useAppStore.getState().togglePlay();
    }
  }, [store.selectedMatchId]);

  // 3. Playback Loop with Delta Clamping
  useEffect(() => {
    if (!store.isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = (timestamp: number) => {
      if (lastUpdateRef.current === 0) {
        lastUpdateRef.current = timestamp;
      }
      
      const deltaMs = timestamp - lastUpdateRef.current;
      lastUpdateRef.current = timestamp;

      // Guard: clamp delta to 500ms max
      const clampedDelta = Math.min(deltaMs, 500);
      const deltaSec = (clampedDelta / 1000) * store.playbackSpeed;
      
      let nextTime = store.playbackTime + deltaSec;
      
      if (nextTime >= store.matchDuration) {
        nextTime = store.matchDuration;
        store.setPlaybackTime(nextTime);
        store.togglePlay(); // Pause at the end
        return;
      }
      
      store.setPlaybackTime(nextTime);
      rafRef.current = requestAnimationFrame(loop);
    };

    lastUpdateRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [store.isPlaying, store.playbackSpeed, store.playbackTime, store.matchDuration]);

  // 4. Page Visibility API
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && useAppStore.getState().isPlaying) {
        useAppStore.getState().togglePlay();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // 5. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      
      const state = useAppStore.getState();
      if (state.matchDuration === 0) return; // disabled

      switch (e.key) {
        case ' ':
          e.preventDefault();
          state.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          state.setPlaybackTime(state.playbackTime - (e.shiftKey ? 30 : 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          state.setPlaybackTime(state.playbackTime + (e.shiftKey ? 30 : 5));
          break;
        case 'Home':
          e.preventDefault();
          state.setPlaybackTime(0);
          break;
        case 'End':
          e.preventDefault();
          state.setPlaybackTime(state.matchDuration);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Format MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    store.setPlaybackTime(parseFloat(e.target.value));
  };

  const setSpeed = (speed: PlaybackSpeed) => {
    store.setPlaybackSpeed(speed);
  };

  const jumpToStart = () => store.setPlaybackTime(0);
  const jumpToEnd = () => store.setPlaybackTime(store.matchDuration);

  // Hover time logic
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const scrubberRef = useRef<HTMLInputElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    let pct = (e.clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    setHoverPct(pct);
  };

  const handleMouseLeave = () => setHoverPct(null);

  // State: disabled / no data
  const isDisabled = store.matchDuration === 0;

  if (isDisabled) {
    return (
      <div className="absolute bottom-0 w-full h-16 bg-gray-900/95 border-t border-gray-800 flex items-center justify-center z-20">
        <span className="text-gray-500 font-medium">No timeline data</span>
      </div>
    );
  }

  const percent = (store.playbackTime / store.matchDuration) * 100 || 0;

  return (
    <div className="absolute bottom-0 w-full bg-gray-900 border-t border-gray-800 flex flex-col z-20 select-none">
      
      {/* ── Scrubber Track ── */}
      <div className="relative w-full h-6 group">
        <input
          ref={scrubberRef}
          type="range"
          min={0}
          max={store.matchDuration}
          step={0.1} // Fine-grained scrubbing
          value={store.playbackTime}
          onChange={handleScrub}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          // Custom CSS for track fill
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
          title="Scrub timeline"
        />
        
        {/* Visual Track */}
        <div 
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 pointer-events-none transition-all group-hover:h-2"
          style={{ background: `linear-gradient(to right, #f97316 ${percent}%, #1a1f2e ${percent}%)` }}
        ></div>

        {/* Custom Thumb */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-500 rounded-full shadow pointer-events-none transition-transform group-hover:scale-125"
          style={{ left: `calc(${percent}% - 8px)` }}
        ></div>

        {/* Hover Time Tooltip */}
        {hoverPct !== null && (
          <div 
            className="absolute -top-8 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow pointer-events-none transform -translate-x-1/2"
            style={{ left: `${hoverPct * 100}%` }}
          >
            {formatTime(hoverPct * store.matchDuration)}
          </div>
        )}
      </div>

      {/* ── Controls Bar ── */}
      <div className="flex items-center justify-between px-6 pb-2 pt-1 h-10">
        
        {/* Left: Playback Controls & Speed */}
        <div className="flex items-center gap-6">
          
          {/* Transport */}
          <div className="flex items-center gap-3">
            <button onClick={jumpToStart} className="text-gray-400 hover:text-white transition-colors focus:outline-none" title="Jump to Start">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button onClick={() => store.togglePlay()} className="text-white hover:text-orange-400 transition-colors focus:outline-none w-6 h-6 flex justify-center items-center" title={store.isPlaying ? "Pause" : "Play"}>
              {store.isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
            <button onClick={jumpToEnd} className="text-gray-400 hover:text-white transition-colors focus:outline-none" title="Jump to End">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>

          {/* Current Time / Duration */}
          <div className="text-sm font-mono text-gray-300 min-w-[90px]">
            {formatTime(store.playbackTime)} / {formatTime(store.matchDuration)}
          </div>

          {/* Speed Pills */}
          <div className="flex items-center gap-1 bg-gray-800 p-0.5 rounded-lg border border-gray-700">
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeed(speed as PlaybackSpeed)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors focus:outline-none ${store.playbackSpeed === speed ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}
              >
                {speed}x
              </button>
            ))}
          </div>

        </div>

        {/* Right: Keyboard Shortcuts Hint */}
        <div className="flex items-center group relative cursor-help">
          <Keyboard className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
          <div className="absolute bottom-8 right-0 w-64 bg-gray-800 text-gray-300 text-xs p-3 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700">
            <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[10px]">Keyboard Shortcuts</h4>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <kbd className="font-mono bg-gray-900 px-1 rounded text-orange-400">Space</kbd> <span>Play / Pause</span>
              <kbd className="font-mono bg-gray-900 px-1 rounded text-orange-400">← / →</kbd> <span>±5 seconds</span>
              <kbd className="font-mono bg-gray-900 px-1 rounded text-orange-400">⇧ + ← / →</kbd> <span>±30 seconds</span>
              <kbd className="font-mono bg-gray-900 px-1 rounded text-orange-400">Home / End</kbd> <span>Jump to ends</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
