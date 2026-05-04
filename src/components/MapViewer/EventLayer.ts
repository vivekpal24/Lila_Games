/**
 * EventLayer.ts — Renders discrete game events using high-quality SVG Icons.
 */

import { useMemo } from 'react';
import { IconLayer } from '@deck.gl/layers';
import { EventType, type GameEvent } from '@appTypes/telemetry';
import { worldToPixel, type MapConfig } from '@utils/coordinateMapper';
import { useAppStore } from '@store/appStore';

// SVG Icons as Data URIs
const ICONS = {
  // Simple Skull SVG
  SKULL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDlhMyAzIDAgMSAwIDAtNm0wIDZhMyAzIDAgMSAwIDAgNm0wLTYuNXYxLjVtLTIuNSAyYTMgMyAwIDAgMSAtMy0zbTAgNmEzIDMgMCAwIDEgMyAzbS0uNS02LjVoMS41bTYuNSAwaC0xLjVtMCA2aDEuNW0tMTEtNkg5LjVtMC00aDRtLTQgMTNoNCIvPjwvc3ZnPg==',
  // Simple Box SVG
  BOX: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDhsLTktNS05IDV2OGw5IDUgOS01Vjh6TTExIDNsOSA1bS05LTNsLTkgNW05IDV2OG0wLThsOSA1bS05LTVsLTkgNSIvPjwvc3ZnPg==',
  // Simple Zap SVG
  ZAP: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJMMyAxNGgxMGwtMSA4IDEwLTEyaC0xMGwxLTh6Ii8+PC9zdmc+'
};

const EVENT_MAP: Partial<Record<EventType, { icon: string, color: [number, number, number, number] }>> = {
  [EventType.Kill]:          { icon: ICONS.SKULL, color: [255, 50, 50, 255] },
  [EventType.BotKill]:       { icon: ICONS.SKULL, color: [255, 50, 50, 255] },
  [EventType.Killed]:        { icon: ICONS.SKULL, color: [255, 120, 0, 255] },
  [EventType.BotKilled]:     { icon: ICONS.SKULL, color: [255, 120, 0, 255] },
  [EventType.KilledByStorm]: { icon: ICONS.ZAP,   color: [180, 0, 255, 255] },
  [EventType.Loot]:          { icon: ICONS.BOX,   color: [255, 255, 0, 255] },
};

const DISCRETE_EVENT_TYPES = new Set<EventType>([
  EventType.Kill, EventType.BotKill,
  EventType.Killed, EventType.BotKilled,
  EventType.KilledByStorm,
  EventType.Loot,
]);

export function useEventLayers(
  allVisible: GameEvent[],
  config: MapConfig | null,
  selectedPlayerId: string | null,
  zoom: number
) {
  const showKills       = useAppStore(s => s.showKills);
  const showDeaths      = useAppStore(s => s.showDeaths);
  const showLoot        = useAppStore(s => s.showLoot);
  const showStormDeaths = useAppStore(s => s.showStormDeaths);

  return useMemo(() => {
    if (!config || allVisible.length === 0) {
      return { layers: [], total: 0 };
    }

    const discrete = allVisible.filter(ev => {
      if (!DISCRETE_EVENT_TYPES.has(ev.eventType)) return false;
      if (ev.eventType === EventType.Kill || ev.eventType === EventType.BotKill) return showKills;
      if (ev.eventType === EventType.Killed || ev.eventType === EventType.BotKilled) return showDeaths;
      if (ev.eventType === EventType.KilledByStorm) return showStormDeaths;
      if (ev.eventType === EventType.Loot) return showLoot;
      return false;
    });

    const MAX_EVENTS = 15000;
    const isSampled  = discrete.length > MAX_EVENTS;
    const finalData  = isSampled ? discrete.slice(0, MAX_EVENTS) : discrete;

    const data = finalData.map(ev => {
      const { px, py } = worldToPixel(ev.worldX, ev.worldZ, config);
      const cfg = EVENT_MAP[ev.eventType] || { icon: ICONS.BOX, color: [255, 255, 255, 255] };
      return {
        position: [px, py],
        icon: cfg.icon,
        color: cfg.color,
        size: ev.userId === selectedPlayerId ? 45 : 30,
        event: ev
      };
    });

    const iconLayer = new IconLayer({
      id: 'event-icons',
      data,
      pickable: true,
      getIcon: (d: any) => ({
        url: d.icon,
        width: 24,
        height: 24,
        anchorY: 12,
        anchorX: 12,
        mask: true
      }),
      getPosition: (d: any) => d.position,
      getSize: (d: any) => d.size,
      getColor: (d: any) => d.color,
      sizeUnits: 'pixels',
      sizeMinPixels: 20
    });

    return {
      layers: [iconLayer],
      total: discrete.length,
      sampled: isSampled
    };
  }, [allVisible, config, showKills, showDeaths, showLoot, showStormDeaths, selectedPlayerId]);
}
