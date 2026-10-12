import React from 'react';
import { Play, Sliders, RotateCcw, Home, Crosshair, CheckCircle2 } from 'lucide-react';
import { MissionObjective } from '../types/game';

interface PauseMenuProps {
  isOpen: boolean;
  missionTitle: string;
  missionCodeName: string;
  objectives: MissionObjective[];
  onResume: () => void;
  onOpenSettings: () => void;
  onRestart: () => void;
  onAbortToMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  missionTitle,
  missionCodeName,
  objectives,
  onResume,
  onOpenSettings,
  onRestart,
  onAbortToMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none font-mono">
      <div className="relative w-full max-w-lg bg-stone-950 border-2 border-emerald-700/80 rounded-lg shadow-2xl p-6 text-slate-200 space-y-6">
        {/* Header */}
        <div className="border-b border-emerald-900 pb-3 text-center">
          <div className="text-[11px] text-emerald-500 font-bold tracking-widest uppercase">
            OPERATION PAUSED // {missionCodeName}
          </div>
          <h2 className="text-xl font-bold text-white tracking-wider mt-0.5">
            {missionTitle}
          </h2>
        </div>

        {/* Current Mission Objectives Status */}
        <div className="space-y-2 bg-black/50 p-4 rounded border border-emerald-950">
          <div className="text-xs font-bold text-emerald-400 tracking-wider mb-2 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            <span>MISSION OBJECTIVES STATUS</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {objectives.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-center justify-between p-1.5 rounded ${
                  obj.isCompleted ? 'text-emerald-400 bg-emerald-950/30' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      obj.isCompleted ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className={obj.isCompleted ? 'line-through text-emerald-500/80' : ''}>
                    {obj.title}
                  </span>
                </div>
                {obj.isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {obj.isOptional ? 'OPTIONAL' : 'PENDING'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Menu Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold tracking-widest text-xs uppercase rounded transition cursor-pointer shadow-lg shadow-emerald-950"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME OPERATION</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-bold tracking-wider text-xs uppercase rounded transition cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>OPERATIONAL SETTINGS</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold tracking-wider text-xs uppercase rounded transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTART OPERATION</span>
          </button>

          <button
            onClick={onAbortToMenu}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-800/80 text-red-300 hover:text-red-100 font-bold tracking-wider text-xs uppercase rounded transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>ABORT TO COMMAND MENU</span>
          </button>
        </div>

        <div className="text-center text-[10px] text-slate-500">
          PRESS [ESC] TO QUICK RESUME
        </div>
      </div>
    </div>
  );
};
