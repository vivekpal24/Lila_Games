# LILA BLACK Telemetry Analytics Dashboard

A high-performance, web-based visualization tool designed for Level Designers to explore player behavior and match dynamics in LILA BLACK.

## 🚀 Key Features

- **Smart Auto-Calibration**: Automatically calculates world-to-pixel coordinate mapping by scanning dataset extremes. No hardcoded bounds required for new maps.
- **Temporal Interpolation**: Smooth LERP-based movement for player icons, providing a high-fidelity representation of in-game paths.
- **Multi-Mode Heatmaps**: Instant aggregation of Kills, Deaths, and Traffic density using WebGL-accelerated rendering.
- **Spawn Visibility**: Early-match visualization that shows all player starting positions from 0:00, preventing "empty map" states.
- **Performance Guard**: Intelligent sampling that protects browser stability when viewing high-density matches (up to 100k+ events).
- **Deep Filtering**: Drill down by Map, Calendar Date, and specific Match IDs using a unified filtering pipeline.

## 🛠️ Technical Architecture

### 1. Data Pipeline
The dashboard utilizes an **in-browser Parquet processing** architecture.
- **Worker-Thread Parsing**: Parquet files are parsed in a Web Worker using `apache-arrow` to ensure the UI thread remains responsive.
- **Zustand State Management**: A centralized store manages filters, playback state, and layer toggles with selective subscriptions to minimize re-renders.

### 2. Rendering Engine (Deck.gl + Luma.gl)
- **IconLayer**: Renders discrete game events (Kills, Loot, etc.) using custom SVG data URIs.
- **PathLayer**: Visualizes player journeys with deterministic color hashing (ensures the same player has the same color across different views).
- **HeatmapLayer**: Utilizes a weight-based aggregation shader to visualize hot zones without the overhead of manual grid counting.

### 3. Coordinate Mapping Logic
The core `coordinateMapper` logic handles the translation between the Game Engine world space and the Browser coordinate space:
- **Axis Alignment**: Automatically flips the Y-axis to reconcile game-space "North" with browser-space "Top".
- **Aspect Ratio Fitting**: Ensures the data "envelope" fits perfectly within the map image without stretching or distortion.
- **Safety Padding**: Implements a 25% boundary buffer to ensure edge-case events are never clipped.

## 📦 Deployment

The project is optimized for deployment on **Vercel** or **Netlify**.
1. Clone the repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Deploy the `dist` folder.

## 🧠 Engineering Decisions & Trade-offs

- **Client-Side vs. Server-Side**: We opted for 100% client-side parsing. For the provided dataset size (~90k events), this provides a "zero-latency" experience and eliminates the cost/complexity of a backend API.
- **Sampling over Fidelity**: In the `usePlayerPath` hook, we sample movement data at 1-second intervals. This significantly improves rendering performance for long matches while maintaining visual accuracy through linear interpolation.
- **Global Calibration**: We chose to scan the *entire match* for boundaries rather than using the *current view*. This prevents the map from "shifting" as players move toward the edges.

---
*Developed as part of the Lila Product Engineer Technical Evaluation.*
