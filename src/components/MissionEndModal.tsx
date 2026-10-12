import React from 'react';
import { Award, RotateCcw, CheckCircle, XCircle, Star, ArrowRight, Home } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface MissionEndModalProps {
  victory: boolean;
  missionTitle: string;
  stats: {
    kills: number;
    headshots: number;
    time: number;
    shotsFired: number;
    accuracy: number;
    alarms: number;
  };
  hasNextMission?: boolean;
  onRestart: () => void;
  onNextMission?: () => void;
  onMainMenu: () => void;
}

export const MissionEndModal: React.FC<MissionEndModalProps> = ({
  victory,
  missionTitle,
  stats,
  hasNextMission,
  onRestart,
  onNextMission,
  onMainMenu,
}) => {
  // Calculate Rank
  let rank = 'B';
  let stars = 0;

  if (victory) {
    stars = 1;
    if (stats.alarms === 0) stars = 2;
    if (stats.alarms === 0 && (stats.accuracy >= 50 || stats.headshots >= 3)) stars = 3;

    if (stars === 3) rank = 'S';
    else if (stars === 2) rank = 'A';
    else if (stats.alarms <= 1) rank = 'B';
    else rank = 'C';
  } else {
    rank = 'F';
    stars = 0;
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono select-none text-emerald-400">
      <div className="relative w-full max-w-xl bg-stone-950 border-2 border-emerald-600/80 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center gap-3 px-6 py-4 border-b ${
            victory
              ? 'bg-emerald-950/70 border-emerald-800'
              : 'bg-red-950/70 border-red-800 text-red-400'
          }`}
        >
          {victory ? (
            <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-500 shrink-0" />
          )}
          <div>
            <h1 className="text-xl font-bold tracking-wider">
              {victory ? 'MISSION ACCOMPLISHED // EXFILTRATED' : 'MISSION FAILED // AGENT K.I.A.'}
            </h1>
            <div className="text-[11px] opacity-80">
              {victory
                ? `${missionTitle.toUpperCase()} OBJECTIVES SECURED // I.G.I. EXTRACTION COMPLETE`
                : 'COMMUNICATIONS SEVERED // AGENT COMPROMISED BY BASE DEFENSES'}
            </div>
          </div>
        </div>

        {/* Content & Stats */}
        <div className="p-6 space-y-5">
          {/* Performance Rank & Stars */}
          <div className="flex items-center justify-between bg-black/60 p-4 rounded border border-emerald-900/80">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-yellow-500 shrink-0" />
              <div>
                <div className="text-[10px] text-emerald-600">OPERATIONAL PERFORMANCE</div>
                <div className="text-base font-bold text-emerald-300">
                  {victory
                    ? stars === 3
                      ? 'GHOST SPECIALIST'
                      : stars === 2
                      ? 'STEALTH OPERATIVE'
                      : 'TACTICAL AGENT'
                    : 'FAILED IN ACTION'}
                </div>
                {/* 3-Star Rating Display */}
                {victory && (
                  <div className="flex items-center gap-1.5 mt-1 text-amber-400">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                    <span className="text-[11px] text-slate-400 ml-1">
                      ({stars}/3 STARS EARNED)
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-4xl font-extrabold text-yellow-400 px-4 py-1 rounded bg-black/80 border border-yellow-500/60">
              {rank}
            </div>
          </div>

          {/* Stats Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-black/60 p-3 rounded border border-emerald-900/60 flex justify-between items-center">
              <span className="text-emerald-600">HOSTILES ELIMINATED:</span>
              <span className="text-emerald-300 font-bold">{stats.kills}</span>
            </div>
            <div className="bg-black/60 p-3 rounded border border-emerald-900/60 flex justify-between items-center">
              <span className="text-emerald-600">HEADSHOT PRECISION:</span>
              <span className="text-emerald-300 font-bold">{stats.headshots}</span>
            </div>
            <div className="bg-black/60 p-3 rounded border border-emerald-900/60 flex justify-between items-center">
              <span className="text-emerald-600">BALLISTIC ACCURACY:</span>
              <span className="text-emerald-300 font-bold">{stats.accuracy}%</span>
            </div>
            <div className="bg-black/60 p-3 rounded border border-emerald-900/60 flex justify-between items-center">
              <span className="text-emerald-600">ALARMS TRIGGERED:</span>
              <span className={stats.alarms > 0 ? 'text-red-400 font-bold' : 'text-emerald-300 font-bold'}>
                {stats.alarms}
              </span>
            </div>
            <div className="bg-black/60 p-3 rounded border border-emerald-900/60 col-span-2 flex justify-between items-center">
              <span className="text-emerald-600">TOTAL MISSION DURATION:</span>
              <span className="text-emerald-300 font-bold">{formatTime(stats.time)}</span>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-emerald-950/40 border-t border-emerald-900/80 flex items-center justify-between">
          <button
            onClick={() => {
              soundManager.playUiClick();
              onMainMenu();
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs rounded transition cursor-pointer flex items-center gap-1.5"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            <span>COMMAND MENU</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundManager.playUiClick();
                onRestart();
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs rounded transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{victory ? 'REPLAY' : 'RETRY'}</span>
            </button>

            {victory && hasNextMission && onNextMission && (
              <button
                onClick={() => {
                  soundManager.playUiClick();
                  onNextMission();
                }}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold tracking-wider text-xs uppercase rounded transition cursor-pointer flex items-center gap-2 shadow-lg"
              >
                <span>NEXT OPERATION</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
