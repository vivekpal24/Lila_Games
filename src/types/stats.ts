import type { EventType } from './telemetry';

export interface MatchSummary {
  totalPlayers: number;
  humanCount: number;
  botCount: number;
  durationSeconds: number;
  totalKills: number;
  totalDeaths: number;
  stormDeaths: number;
  lootEvents: number;
  avgSurvivalTimeSeconds: number;
  killsPerMinute: number;
}

export interface HotZone {
  cellX: number;
  cellY: number;
  count: number;
  percentOfTotal: number;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
  lootCount: number;
  isBot: boolean;
  survivalTimeSeconds: number;
  distanceTraveledUnits: number;
}

export interface DeadZone {
  cellX: number;
  cellY: number;
  percentOfTotal: number;
}

export interface BehaviorComparison {
  humanAvgSurvivalSeconds: number;
  botAvgSurvivalSeconds: number;
  humanAvgKills: number;
  botAvgKills: number;
  humanAvgDistanceTraveled: number;
  botAvgDistanceTraveled: number;
}

export interface StormDeathAnalysis {
  earlyStormDeaths: number;
  lateStormDeaths: number;
  hotspots: HotZone[];
}
