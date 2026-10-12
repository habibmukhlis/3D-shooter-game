import React from 'react';
import { Eye, BatteryCharging } from 'lucide-react';

interface NightVisionOverlayProps {
  battery: number; // 0 to 100
}

export const NightVisionOverlay: React.FC<NightVisionOverlayProps> = ({ battery }) => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-emerald-300">
      {/* 1. Green Phosphor Filter with Radial Vignette */}
      <div
        className="absolute inset-0 mix-blend-color pointer-events-none"
        style={{
          backgroundColor: '#10b981',
          opacity: 0.35,
        }}
      />
      <div
        className="absolute inset-0 mix-blend-screen pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.45) 30%, rgba(5, 46, 22, 0.8) 90%, black 100%)',
        }}
      />

      {/* 2. CRT Scanline Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0px, rgba(0, 0, 0, 0.4) 2px, transparent 2px, transparent 4px)',
        }}
      />

      {/* 3. NVG Status Header */}
      <div className="absolute top-5 left-5 flex items-center gap-3 bg-black/60 px-3 py-1.5 rounded border border-emerald-500/60 backdrop-blur-xs text-xs">
        <Eye className="w-4 h-4 text-emerald-400 animate-pulse" />
        <span className="font-bold tracking-wider">NVG // AN/PVS-7 ACTIVE</span>
        <div className="flex items-center gap-1.5 ml-2 border-l border-emerald-900 pl-2">
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px]">{Math.round(battery)}%</span>
        </div>
      </div>
    </div>
  );
};
