// helpers.ts — General-purpose utility functions used across Lila Viz

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format milliseconds as MM:SS string. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format an ISO date string to human-readable form (e.g. "May 2, 2026"). */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/** Parse a hex color string to [r, g, b] (0–255 each). */
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

/** Encode [r, g, b] to a hex color string. */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Debounce a function call by `delay` ms. */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

/** Returns true if the value is a finite number (not NaN, not Infinity). */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}
