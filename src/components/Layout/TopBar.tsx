import React, { useState } from 'react';
import { Trophy, RotateCcw, Map as MapIcon, Calendar, Hash, Info, X } from 'lucide-react';
import { useAppStore } from '@store/appStore';
import { MapId, type MatchSession } from '@appTypes/telemetry';

interface TopBarProps {
  sessions: MatchSession[];
}

export function TopBar({ sessions }: TopBarProps) {
  const store = useAppStore();
  const [showAbout, setShowAbout] = useState(false);

  const handleMapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    store.setFilter('selectedMapId', (e.target.value as MapId) || null);
  };

  const [availableDates, setAvailableDates] = React.useState<string[]>([]);

  React.useEffect(() => {
    import('@utils/parquetLoader').then(({ getAvailableDates }) => {
      getAvailableDates().then(setAvailableDates);
    });
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    store.setFilter('selectedDate', e.target.value || null);
  };

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    store.setFilter('selectedMatchId', e.target.value || null);
  };

  const resetFilters = () => {
    store.setFilter('selectedMapId', null);
    store.setFilter('selectedDate', null);
    store.setFilter('selectedMatchId', null);
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-16 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 z-20 pointer-events-auto">
      
      {/* Logo */}
      <div className="flex items-center gap-3">
        <h1 className="text-orange-500 font-bold text-2xl tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>
          LILA
        </h1>
        <span className="text-gray-500 font-mono text-sm mt-1 uppercase tracking-widest hidden sm:inline-block">Viz Analytics</span>
      </div>

      {/* Selectors */}
      <div className="flex items-center gap-4">
        
        {/* Map Selector */}
        <div className="relative group flex items-center bg-gray-800/80 rounded-md border border-gray-700 hover:border-gray-500 transition-colors focus-within:ring-2 focus-within:ring-orange-500">
          <MapIcon className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <select 
            value={store.selectedMapId || ''} 
            onChange={handleMapChange}
            className="appearance-none bg-transparent text-sm text-gray-200 py-2 pl-9 pr-8 outline-none cursor-pointer w-40"
            title="Select Map"
          >
            <option value="" className="bg-gray-800 text-gray-400 italic">Select Map</option>
            <option value={MapId.AMBROSE_VALLEY} className="bg-gray-800">Ambrose Valley</option>
            <option value={MapId.GRAND_RIFT} className="bg-gray-800">Grand Rift</option>
            <option value={MapId.LOCKDOWN} className="bg-gray-800">Lockdown</option>
          </select>
          <div className="pointer-events-none absolute right-3 flex items-center">
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        {/* Date Selector (Custom) */}
        <div className="relative group flex items-center bg-gray-800/80 rounded-md border border-gray-700 hover:border-gray-500 transition-colors focus-within:ring-2 focus-within:ring-orange-500">
          <Calendar className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <select 
            value={store.selectedDate || ''}
            onChange={handleDateChange}
            className="appearance-none bg-transparent text-sm text-gray-200 py-2 pl-9 pr-8 outline-none cursor-pointer w-44"
            title="Select Date"
          >
            {availableDates.length === 0 && <option value="" className="bg-gray-800">Loading Dates...</option>}
            {availableDates.map(date => (
              <option key={date} value={date} className="bg-gray-800">
                {new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 flex items-center">
            <svg className="w-4 h-4 text-gray-400 group-hover:text-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        {/* Match Selector */}
        <div className="relative group flex items-center bg-gray-800/80 rounded-md border border-gray-700 hover:border-gray-500 transition-colors focus-within:ring-2 focus-within:ring-orange-500">
          <Hash className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <select 
            value={store.selectedMatchId || ''} 
            onChange={handleMatchChange}
            className="appearance-none bg-transparent text-sm text-gray-200 py-2 pl-9 pr-8 outline-none cursor-pointer w-64 text-ellipsis"
            title="Select Match"
          >
            <option value="" className="bg-gray-800">All Matches</option>
            {sessions.map(s => (
              <option key={s.matchId} value={s.matchId} className="bg-gray-800">
                {s.matchId.split('-')[0]} - {s.startTime ? s.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'} ({s.humanCount + s.botCount} players, {Math.floor(s.durationSeconds / 60)}m {Math.floor(s.durationSeconds % 60)}s)
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 flex items-center">
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        {/* Reset Button */}
        <button 
          onClick={resetFilters}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="Reset all filters"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setShowAbout(true)}
          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="About this tool"
        >
          <Info className="w-5 h-5" />
        </button>
        <button 
          onClick={() => console.log('Leaderboard clicked')}
          className="p-2 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
          title="Leaderboard"
        >
          <Trophy className="w-5 h-5" />
        </button>
      </div>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-5 h-5" />
                <h2 className="font-bold">About this tool</h2>
              </div>
              <button onClick={() => setShowAbout(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <ul className="space-y-4 text-sm text-gray-300">
                <li className="flex gap-3">
                  <span className="text-blue-500">•</span>
                  <span>Data is not real-time — files are pre-exported snapshots</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-500">•</span>
                  <span>Browser memory limits: very large matches (&gt;500k events) may cause slowdown</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-500">•</span>
                  <span>Coordinate mapping is auto-calibrated — accuracy depends on data coverage</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-500">•</span>
                  <span>Designed for desktop at 1440px+ resolution</span>
                </li>
              </ul>
              <div className="mt-8 text-center">
                <button 
                  onClick={() => setShowAbout(false)}
                  className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-medium transition-colors border border-gray-700"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
