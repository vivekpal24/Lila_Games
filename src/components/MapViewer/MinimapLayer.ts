/**
 * MinimapLayer.ts — BitmapLayer rendering the minimap PNG at z=0 (bottom layer).
 * If the image fails to load, renders a fallback grid using Polygon, Path, and Text layers.
 * Coordinate system: image pixels, (0,0) = top-left, y increases downward.
 */

import { BitmapLayer, SolidPolygonLayer, PathLayer, TextLayer } from '@deck.gl/layers';
import type { MapConfig } from '@utils/coordinateMapper';

export function buildMinimapLayer(
  imageUrl: string,
  config: MapConfig,
  imageFailed: boolean
): any[] {
  if (!imageFailed) {
    return [
      new BitmapLayer({
        id:        'minimap-bitmap',
        // bounds: [left, bottom, right, top] in world/pixel space
        // With flipY:false on OrthographicView, y=0 is top → [0, imageHeight, imageWidth, 0]
        bounds:    [0, config.imageHeight, config.imageWidth, 0],
        image:     imageUrl,
        opacity:   1,
        pickable:  false,
      })
    ];
  }

  // Fallback Grid
  const { imageWidth, imageHeight } = config;
  
  const background = new SolidPolygonLayer({
    id: 'grid-bg',
    data: [{ polygon: [[0, 0], [imageWidth, 0], [imageWidth, imageHeight], [0, imageHeight]] }],
    getPolygon: (d: any) => d.polygon,
    getFillColor: [30, 41, 59, 255], // Tailwind slate-800
    pickable: false,
  });

  // Basic grid lines
  const gridLines = [];
  const stepX = imageWidth / 10;
  const stepY = imageHeight / 10;
  
  for (let x = 0; x <= imageWidth; x += stepX) {
    gridLines.push({ path: [[x, 0], [x, imageHeight]] });
  }
  for (let y = 0; y <= imageHeight; y += stepY) {
    gridLines.push({ path: [[0, y], [imageWidth, y]] });
  }

  const lines = new PathLayer({
    id: 'grid-lines',
    data: gridLines,
    getPath: (d: any) => d.path,
    getColor: [71, 85, 105, 255], // Tailwind slate-600
    getWidth: 2,
    widthUnits: 'pixels',
    pickable: false,
  });

  const labels = new TextLayer({
    id: 'grid-labels',
    data: [
      { text: '(0, 0)', position: [10, 20] },
      { text: `(${imageWidth}, ${imageHeight})`, position: [imageWidth - 10, imageHeight - 20] }
    ],
    getText: (d: any) => d.text,
    getPosition: (d: any) => d.position,
    getColor: [148, 163, 184, 255], // Tailwind slate-400
    getSize: 24,
    sizeUnits: 'pixels',
    getTextAnchor: 'start',
    getAlignmentBaseline: 'top',
    pickable: false,
  });

  return [background, lines, labels];
}
