import React, { useMemo, useState } from 'react';
import { Copy, X, Check, Activity, Skull, Package, Zap } from 'lucide-react';
import { useAppStore } from '@store/appStore';
import { EventType, PlayerType, type MatchSession, type GameEvent } from '@appTypes/telemetry';
import { getPlayerStats } from '@utils/statsEngine';

interface PlayerDetailProps {
  currentSession: MatchSession | null;
}

export function PlayerDetail({ currentSession }: PlayerDetailProps) {
  const store = useAppStore();
  const selectedPlayerId = store.selectedPlayerId;
  const [copied, setCopied] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);

  const playerData = useMemo(() => {
    if (!currentSession || !selectedPlayerId) return null;

    const events = currentSession.events.filter(e => e.userId === selectedPlayerId);
    if (events.length === 0) return null;

    // Use statsEngine for derived properties
    const stats = getPlayerStats(currentSession.events, selectedPlayerId);
    const playerType = stats.isBot ? PlayerType.BOT : PlayerType.HUMAN;

    // Sort events by timestamp descending for the log
    const sortedEvents = [...events].sort((a, b) => b.timestampMs - a.timestampMs);

    return { 
      events: sortedEvents, 
      playerType, 
      kills: stats.kills, 
      deaths: stats.deaths, 
      loot: stats.lootCount 
    };
  }, [currentSession?.events, selectedPlayerId]);

  if (!selectedPlayerId || !playerData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedPlayerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayId = selectedPlayerId.length > 12 
    ? `${selectedPlayerId.substring(0, 8)}...${selectedPlayerId.substring(selectedPlayerId.length - 4)}` 
    : selectedPlayerId;

  return (
    <div className="absolute top-20 left-6 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-800 shadow-2xl z-30 rounded-lg overflow-hidden flex flex-col pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800/50 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${playerData.playerType === PlayerType.HUMAN ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-700 text-gray-300 border border-gray-600'}`}>
            {playerData.playerType}
          </div>
          <div className="group flex items-center gap-1 cursor-pointer" onClick={handleCopy} title="Copy full ID">
            <span className="font-mono text-sm text-gray-200">{displayId}</span>
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />}
          </div>
        </div>
        <button 
          onClick={() => store.selectPlayer(null)}
          className="p-1 text-gray-400 hover:text-white rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
        <StatBox label="Kills" value={playerData.kills} color="text-red-400" />
        <StatBox label="Deaths" value={playerData.deaths} color="text-orange-400" />
        <StatBox label="Loot" value={playerData.loot} color="text-yellow-400" />
      </div>

      {/* Event Log */}
      <div className="p-3 bg-gray-900/50">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Event Log</h3>
        <div className="max-h-[200px] overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
          {playerData.events.slice(0, visibleLimit).map((ev, i) => (
            <EventRow key={`${ev.timestampMs}-${i}`} event={ev} />
          ))}
          {playerData.events.length > visibleLimit && (
            <button 
              onClick={() => setVisibleLimit(l => l + 50)}
              className="w-full text-center py-2 text-xs text-orange-500 hover:text-orange-400 focus:outline-none"
            >
              Load more...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-2 bg-gray-800/20">
      <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function EventRow({ event }: { event: GameEvent }) {
  const timeStr = new Date(event.timestampMs).toISOString().substr(14, 5); // mm:ss
  
  let Icon = Activity;
  let color = 'text-gray-400';
  let label = 'Moved';

  switch (event.eventType) {
    case EventType.Kill:
    case EventType.BotKill:
      Icon = Skull; color = 'text-red-400'; label = 'Kill'; break;
    case EventType.Killed:
    case EventType.BotKilled:
      Icon = Skull; color = 'text-orange-400'; label = 'Killed'; break;
    case EventType.KilledByStorm:
      Icon = Zap; color = 'text-purple-400'; label = 'Storm'; break;
    case EventType.Loot:
      Icon = Package; color = 'text-yellow-400'; label = 'Loot'; break;
  }

  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 px-1 rounded">
      <div className="flex items-center gap-2">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-xs text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-500 font-mono">[{Math.round(event.worldX)}, {Math.round(event.worldZ)}]</span>
        <span className="text-xs font-mono text-gray-400">{timeStr}</span>
      </div>
    </div>
  );
}
