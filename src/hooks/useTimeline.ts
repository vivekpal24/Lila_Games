// useTimeline.ts — Drives the playback animation loop via requestAnimationFrame.
// Reads PlaybackState from the store and writes currentTimeMs on each frame.

import { useEffect, useRef } from 'react';
import { useAppStore }       from '@store/useAppStore';
import { clamp }             from '@utils/helpers';
import type { PlaybackSpeed } from '@appTypes/telemetry';

interface TimelineControls {
  currentTimeMs: number;
  durationMs:    number;
  isPlaying:     boolean;
  speed:         PlaybackSpeed;
  play:   () => void;
  pause:  () => void;
  seek:   (ms: number) => void;
  setSpeed: (s: PlaybackSpeed) => void;
}

export function useTimeline(): TimelineControls {
  const playback      = useAppStore(s => s.playback);
  const updatePlayback = useAppStore(s => s.updatePlayback);
  const setSpeed      = useAppStore(s => s.setSpeed);

  const rafRef      = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playback.isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    function tick(now: number) {
      const last = lastTimeRef.current ?? now;
      lastTimeRef.current = now;

      const wallDelta = now - last; // ms since last frame

      // Read latest state directly via getState to avoid stale closure
      const state = useAppStore.getState().playback;
      const next  = state.currentTimeMs + wallDelta * state.speed;
      const clamped = clamp(next, 0, state.durationMs);
      const done  = clamped >= state.durationMs;

      useAppStore.getState().updatePlayback({
        currentTimeMs: clamped,
        isPlaying:     !done,
      });

      if (!done) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playback.isPlaying]);

  return {
    currentTimeMs: playback.currentTimeMs,
    durationMs:    playback.durationMs,
    isPlaying:     playback.isPlaying,
    speed:         playback.speed,
    play:          () => updatePlayback({ isPlaying: true }),
    pause:         () => updatePlayback({ isPlaying: false }),
    seek:          (ms) => updatePlayback({ currentTimeMs: clamp(ms, 0, playback.durationMs) }),
    setSpeed,
  };
}
