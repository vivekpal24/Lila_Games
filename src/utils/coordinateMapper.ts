/**
 * coordinateMapper.ts — World-space → minimap-pixel coordinate transform.
 */

import { MapId, type GameEvent } from '@appTypes/telemetry';

export interface MapConfig {
  readonly mapId: MapId;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly worldMinX: number;
  readonly worldMaxX: number;
  readonly worldMinY: number;
  readonly worldMaxY: number;
  readonly yAxisFlipped: boolean;
}

export const MAP_CONFIGS: Partial<Record<MapId, MapConfig>> = {};

/** 
 * Hardcoded coordinate bounds for specific maps. 
 * We keep this empty to allow Smart Auto-Calibration to take full control.
 */
const KNOWN_MAP_BOUNDS: Partial<Record<MapId, { minX: number; maxX: number; minY: number; maxY: number }>> = {
};

export function calibrateMapConfig(events: GameEvent[], mapId: MapId, image: HTMLImageElement): MapConfig {
  const imgW = image.naturalWidth || 4320;
  const imgH = image.naturalHeight || 4320;
  const aspectRatio = imgW / imgH;

  if (events.length === 0) {
    return { mapId, imageWidth: imgW, imageHeight: imgH, worldMinX: -500, worldMaxX: 500, worldMinY: -500, worldMaxY: 500, yAxisFlipped: true };
  }

  // 1. Find absolute bounds
  const xs = events.map(e => e.worldX).sort((a, b) => a - b);
  const zs = events.map(e => e.worldZ).sort((a, b) => a - b);

  let minX = xs[0], maxX = xs[xs.length - 1];
  let minZ = zs[0], maxZ = zs[zs.length - 1];

  // 2. Add 20% buffer to ensure nothing is clipped and map feels centered
  const padX = (maxX - minX) * 0.25 || 100;
  const padZ = (maxZ - minZ) * 0.25 || 100;

  minX -= padX; maxX += padX;
  minZ -= padZ; maxZ += padZ;

  // 3. Force Aspect Ratio match
  const dataW = maxX - minX;
  const dataH = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  let finalW = dataW;
  let finalH = finalW / aspectRatio;

  if (finalH < dataH) {
    finalH = dataH;
    finalW = finalH * aspectRatio;
  }

  const config: MapConfig = {
    mapId,
    imageWidth: imgW,
    imageHeight: imgH,
    worldMinX: centerX - finalW / 2,
    worldMaxX: centerX + finalW / 2,
    worldMinY: centerZ - finalH / 2,
    worldMaxY: centerZ + finalH / 2,
    yAxisFlipped: true,
  };

  MAP_CONFIGS[mapId] = config;
  console.info(`[coordinateMapper] ✓ Global Calibration for "${mapId}" | Range: ${finalW.toFixed(0)}x${finalH.toFixed(0)}`);
  return config;
}

export function worldToPixel(worldX: number, worldY: number, config: MapConfig): { px: number; py: number; isClamped: boolean } {
  let px = ((worldX - config.worldMinX) / (config.worldMaxX - config.worldMinX)) * config.imageWidth;
  let py = ((worldY - config.worldMinY) / (config.worldMaxY - config.worldMinY)) * config.imageHeight;

  if (config.yAxisFlipped) {
    py = config.imageHeight - py;
  }

  const isClamped = px < 0 || px > config.imageWidth || py < 0 || py > config.imageHeight;
  return { px, py, isClamped };
}

export function pixelToWorld(px: number, py: number, config: MapConfig): { worldX: number; worldZ: number } {
  let relativePy = py;
  if (config.yAxisFlipped) {
    relativePy = config.imageHeight - py;
  }

  const worldX = config.worldMinX + (px / config.imageWidth) * (config.worldMaxX - config.worldMinX);
  const worldZ = config.worldMinY + (relativePy / config.imageHeight) * (config.worldMaxY - config.worldMinY);

  return { worldX, worldZ };
}
