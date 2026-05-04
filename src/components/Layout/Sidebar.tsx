import React, { useState, useMemo } from 'react';
import { Menu, ChevronRight, Activity, Skull, Zap, Map as MapIcon, Package, Users } from 'lucide-react';
import { useAppStore } from '@store/appStore';
import { EventType, type MatchSession } from '@appTypes/telemetry';
import { getMatchSummary } from '@utils/statsEngine';

interface SidebarProps {
  currentSession: MatchSession | null;
}

export function Sidebar({ currentSession }: SidebarProps) {
  const store = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  // Quick Stats
  const stats = useMemo(() => {
    if (!currentSession) return null;
    return getMatchSummary(currentSession.events, currentSession.matchId);
  }, [currentSession?.events, currentSession?.matchId]);

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute top-4 right-4 z-30 p-2 bg-gray-900/90 text-white rounded-md border border-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-lg backdrop-blur-md transition-colors"
          title="Open Control Panel"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar Panel */}
      <div 
        className={`absolute top-0 right-0 h-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl z-30 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '280px' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest">Controls</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Close Panel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-8 scrollbar-thin scrollbar-thumb-gray-700">
          
          {/* LAYERS */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Layers</h3>
            <div className="space-y-2">
              <ToggleRow 
                label="Movement Paths" 
                icon={<Activity className="w-4 h-4 text-blue-400" />} 
                checked={store.showMovementPaths} 
                onChange={() => store.toggleLayer('showMovementPaths')} 
              />
              <ToggleRow 
                label="Kills" 
                icon={<Skull className="w-4 h-4 text-red-500" />} 
                checked={store.showKills} 
                onChange={() => store.toggleLayer('showKills')} 
              />
              <ToggleRow 
                label="Deaths" 
                icon={<Skull className="w-4 h-4 text-orange-500" />} 
                checked={store.showDeaths} 
                onChange={() => store.toggleLayer('showDeaths')} 
              />
              <ToggleRow 
                label="Storm Deaths" 
                icon={<Zap className="w-4 h-4 text-purple-500" />} 
                checked={store.showStormDeaths} 
                onChange={() => store.toggleLayer('showStormDeaths')} 
              />
              <ToggleRow 
                label="Loot" 
                icon={<Package className="w-4 h-4 text-yellow-500" />} 
                checked={store.showLoot} 
                onChange={() => store.toggleLayer('showLoot')} 
              />
              <div className="my-2 border-t border-gray-800" />
              <ToggleRow 
                label="Show Bots" 
                icon={<Users className="w-4 h-4 text-gray-400" />} 
                checked={store.showBots} 
                onChange={() => store.toggleLayer('showBots')} 
              />
            </div>
          </section>

          {/* HEATMAP */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Heatmap</h3>
              <button 
                onClick={() => store.toggleLayer('showHeatmap')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 focus:ring-offset-gray-900 ${store.showHeatmap ? 'bg-orange-500' : 'bg-gray-700'}`}
                title="Toggle Heatmap"
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${store.showHeatmap ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className={`flex bg-gray-800/50 p-1 rounded-lg border border-gray-700/50 transition-opacity ${!store.showHeatmap && 'opacity-50 pointer-events-none'}`}>
              <ModePill label="Kills" active={store.heatmapMode === 'kills'} onClick={() => store.setHeatmapMode('kills')} />
              <ModePill label="Deaths" active={store.heatmapMode === 'deaths'} onClick={() => store.setHeatmapMode('deaths')} />
              <ModePill label="Traffic" active={store.heatmapMode === 'traffic'} onClick={() => store.setHeatmapMode('traffic')} />
            </div>
          </section>

          {/* QUICK STATS */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Quick Stats</h3>
            {stats ? (
              <div className="space-y-3 bg-gray-800/30 rounded-lg p-3 border border-gray-800/50">
                <StatRow label="Total Players" value={stats.totalPlayers} />
                <StatRow label="Humans / Bots" value={`${stats.humanCount} / ${stats.botCount}`} />
                <StatRow label="Match Duration" value={`${Math.floor(stats.durationSeconds / 60)}m ${Math.floor(stats.durationSeconds % 60)}s`} />
                <StatRow label="Total Kills" value={stats.totalKills} />
                <StatRow label="Storm Deaths" value={stats.stormDeaths} />
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic px-2">Select a match to view stats</div>
            )}
          </section>

        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToggleRow({ label, icon, checked, onChange }: { label: string, icon: React.ReactNode, checked: boolean, onChange: () => void }) {
  return (
    <label className="flex items-center justify-between group cursor-pointer p-1.5 -mx-1.5 rounded hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
      </div>
      <button 
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(); }}
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 focus:ring-offset-gray-900 ${checked ? 'bg-orange-500' : 'bg-gray-700'}`}
      >
        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

function ModePill({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${active ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
    >
      {label}
    </button>
  );
}

function StatRow({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-white font-mono">{value}</span>
    </div>
  );
}
