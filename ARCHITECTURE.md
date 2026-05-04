# Architecture: LILA Player Journey Visualization Tool

## System Design

**This is a pure client-side analytics tool.** There is no backend.
Parquet files are served as static assets. All parsing, coordinate mapping,
and rendering happen in the browser. This design was chosen deliberately:
- The dataset is small enough for in-browser parsing (~few MB/day)
- Eliminates backend infrastructure, auth, and ops complexity
- Deploys as a single static site (Vercel, zero config)

*Scalability note: If data grows beyond ~500MB/day, the architecture would evolve
to a backend aggregation service serving pre-computed JSON. This is a known tradeoff.*

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React + Vite + TypeScript | Fast iteration, strong typing for complex telemetry types |
| Rendering | deck.gl (OrthographicView) | GPU-accelerated, handles 100k+ points, native support for flat image coordinate systems |
| Data parsing | apache-arrow (in-browser) | Efficient columnar parquet parsing without a server |
| State | Zustand | Minimal boilerplate, selector-based subscriptions prevent unnecessary re-renders |
| Hosting | Vercel | Static deploy, global CDN, zero config |

*Note: Leaflet was explicitly excluded. Leaflet is designed for geographic maps (lat/lng).
Our coordinate system is a flat game world. deck.gl's OrthographicView is the correct
primitive — it treats coordinates as flat pixel space, which matches exactly.*

## Data Flow

```
/public/data/*.parquet
        │
        ▼ (Web Worker — no main thread blocking)
  apache-arrow parse
        │
        ▼
  Type validation + coordinate calibration
        │
        ▼
  Zustand store (MatchSession[])
        │
        ▼
  deck.gl layers (ScatterplotLayer, PathLayer, HeatmapLayer, BitmapLayer)
        │
        ▼
  WebGL canvas render → User sees events on minimap
        │
        ▼ (user interaction)
  Zustand filter/playback update → layers re-render
```

## Coordinate Mapping

The game world uses its own coordinate system (Unreal Engine units, exact scale unknown).
The minimap is a flat PNG image with pixel coordinates.

**Approach: auto-calibration**
We scan all events for each map to find (worldMinX, worldMaxX, worldMinY, worldMaxY),
add 5% padding, then apply a linear transform:

```
px = (worldX - worldMinX) / (worldMaxX - worldMinX) * imageWidth
py = (1 - (worldY - worldMinY) / (worldMaxY - worldMinY)) * imageHeight  // Y-axis flip
```

Y is flipped because game world Y increases upward (standard math convention) while
image pixel Y increases downward.

**Validation**: After calibration, we count events whose raw coords fall outside the
calibrated range. If >2% are outliers, we log a warning. This is exposed in the debug
overlay (?debug=1 in URL).

**Known limitation**: If a region of the map has zero player traffic, it won't appear
in the calibration range. Mapping may be slightly inaccurate at the margins.

## Assumptions

| Assumption | Why | Impact if wrong |
|---|---|---|
| Bot detection: column first, name heuristic fallback | Column sometimes missing per README | Some bots misclassified as humans — low visual impact |
| World bounds auto-calibrated from data | README provides no exact world bounds | <2% of events may render at edge; validated by outlier check |
| Y-axis flipped (world Y-up, image Y-down) | Standard game engine convention | All events appear vertically mirrored — detectable immediately |
| Matches < 2 humans flagged invalid | Likely test/bot lobbies | Some valid edge-case matches hidden — acceptable |
| Null timestamps sorted by event index | ~0.3% of rows affected | Minor ordering inaccuracy for affected rows |

## Known Limitations

- Not real-time: data is pre-exported snapshots, not live
- Browser memory: matches with >500k events may cause slowdown on low-RAM machines
- Coordinate accuracy: auto-calibration works well when data covers the full map
- Designed for desktop (1440px+): mobile layout not supported
- Parquet files must be hosted as static assets (no dynamic upload in this version)

## Tradeoffs

| Decision | Alternative | Chose | Reason |
|---|---|---|---|
| In-browser parsing | Backend API | In-browser | Eliminates backend ops; viable at current data scale |
| deck.gl | SVG / Canvas2D | deck.gl | SVG degrades past ~5k elements; deck.gl scales to 1M+ |
| Auto-calibrated coords | Hardcoded bounds | Auto-calibrated | No exact world bounds in README; auto is more robust |
| Static deploy | Docker/Railway | Vercel static | Simpler, faster, free tier sufficient |
| Sampled movement paths | Raw path data | Sampled (1s interval) | Raw paths at 60fps = thousands of points; 1s sample gives same visual with 60x less data |
