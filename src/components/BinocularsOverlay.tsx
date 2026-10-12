import React from 'react';
import { Target, Radio } from 'lucide-react';
import { EnemyData } from '../types/game';

interface BinocularsOverlayProps {
  targetDistance: number | null;
  compassHeading: number;
  targetedEnemy: EnemyData | null;
  onTagEnemy: () => void;
}

export const BinocularsOverlay: React.FC<BinocularsOverlayProps> = ({
  targetDistance,
  compassHeading,
  targetedEnemy,
  onTagEnemy,
}) => {
  return (
    <div
      onClick={onTagEnemy}
      className="absolute inset-0 pointer-events-auto select-none flex items-center justify-center overflow-hidden cursor-crosshair font-mono text-emerald-400"
    >
      {/* Dual Barrel Binoculars Mask */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 35% 50%, transparent 26%, rgba(0,0,0,0.88) 32%, black 37%),
                       radial-gradient(circle at 65% 50%, transparent 26%, rgba(0,0,0,0.88) 32%, black 37%)`,
        }}
      />

      {/* Center Tactical Digital HUD */}
      <div className="relative z-10 w-[60vh] h-[40vh] border border-emerald-500/40 rounded flex flex-col items-center justify-between p-4 pointer-events-none">
        {/* Top Telemetry */}
        <div className="w-full flex justify-between items-center text-xs border-b border-emerald-500/40 pb-1">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>I.G.I. RECON OPTICS // 8.0X</span>
          </div>
          <div className="text-emerald-400 font-bold">
            HDG: {Math.round(compassHeading)}°
          </div>
        </div>

        {/* Center Reticle */}
        <div className="relative flex items-center justify-center">
          {/* Crosshair */}
          <div className="w-24 h-[1px] bg-emerald-400/80" />
          <div className="h-24 w-[1px] bg-emerald-400/80 absolute" />
          <div className="w-12 h-12 border border-emerald-400/60 rounded-full absolute" />

          {/* Locked Enemy Indicator */}
          {targetedEnemy && (
            <div className="absolute flex flex-col items-center -top-14 animate-pulse">
              <div className="flex items-center gap-1 text-[11px] bg-black/75 px-2 py-0.5 rounded border border-red-500 text-red-400 font-bold">
                <Target className="w-3.5 h-3.5" />
                <span>{targetedEnemy.name.toUpperCase()}</span>
              </div>
              <div className="text-[10px] text-yellow-400 mt-1">
                STATUS: {targetedEnemy.alertState.toUpperCase()} // HP: {targetedEnemy.health}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Rangefinder */}
        <div className="w-full flex justify-between items-end text-xs border-t border-emerald-500/40 pt-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-emerald-600">LASER RANGEFINDER</span>
            <span className="text-xl font-extrabold text-emerald-200">
              {targetDistance !== null ? `${targetDistance.toFixed(1)} M` : '--- M'}
            </span>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-emerald-400/80 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800">
              [LEFT CLICK] TAG HOSTILE TARGET
            </div>
            <div className="text-[9px] text-emerald-600 mt-0.5">PRESS [B] TO EXIT BINOCULARS</div>
          </div>
        </div>
      </div>
    </div>
  );
};
