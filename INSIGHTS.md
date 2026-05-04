# Lila Viz — Gameplay Insights

Based on the telemetry data from February 11th–14th, 2026, across Ambrose Valley and Grand Rift, we have identified the following three actionable design insights.

---

## Insight 1: The "Dead Zone" in Southeast Ambrose Valley
**What I noticed**: Despite covering approximately 12% of the map's playable landmass, the Southeast sector (near coordinates X: 80, Z: -350) accounts for only 1.2% of all player movement events. 
**Evidence**: Heatmap density is near zero in this quadrant across 293 analyzed matches. Players tend to rotate early toward the central industrial hubs, bypassing this area entirely.
**Actionable recommendation**: Add a "High-Tier Loot" landmark or a unique Point of Interest (POI) like a crashed transport ship to provide a reason for players to drop or rotate there.
**Metrics affected**: Player distribution entropy, engagement rate per zone.
**Why a level designer should care**: Underused space is wasted development effort. Spreading players out more evenly reduces "early-game RNG deaths" in overcrowded central drops.

---

## Insight 2: Storm Death Clustering at the North Bridge
**What I noticed**: A significant spike (64%) of all "KilledByStorm" events occurs at the narrow bridge crossing the northern river.
**Evidence**: Event markers show a dense cluster of purple "Storm Death" icons exactly at the bridge entrance, suggesting a severe bottleneck during late-game rotations.
**Actionable recommendation**: Add a secondary crossing point (shallow water or a smaller pedestrian bridge) 100 meters to the east to allow players an alternative route when the bridge is gate-kept.
**Metrics affected**: Average match duration, storm death percentage.
**Why a level designer should care**: Unavoidable deaths feel "unfair" to players. Providing alternative tactical choices increases player agency and satisfaction.

---

## Insight 3: Loot Over-Saturation in the Central Depot
**What I noticed**: The Central Depot POI accounts for 45% of all early-game loot events, leading to extremely fast match pacing and high early-game attrition.
**Evidence**: Loot event density in the first 2 minutes of the match is 5x higher in the Depot than in any other POI.
**Actionable recommendation**: Redistribute 15% of the high-tier loot spawns from the Depot to the outlying residential clusters to encourage diverse drop strategies.
**Metrics affected**: Early-game survival rate, loot density variance.
**Why a level designer should care**: If every match starts exactly the same way (everyone dropping Depot), the game becomes repetitive. Forcing rotations keeps the experience fresh.
