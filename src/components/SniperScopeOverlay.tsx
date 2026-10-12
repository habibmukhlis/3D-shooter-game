import React from 'react';

export const SniperScopeOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden">
      {/* 1. Heavy Black Scope Housing Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 36%, rgba(0,0,0,0.92) 39%, black 43%)',
        }}
      />

      {/* 2. Lens Greenish Tint & Subtle Reflection */}
      <div className="w-[68vh] h-[68vh] rounded-full border border-emerald-900/60 relative flex items-center justify-center bg-emerald-950/5 shadow-inner">
        {/* Horizontal Crosshair Line */}
        <div className="absolute w-full h-[1px] bg-emerald-500/80" />
        {/* Vertical Crosshair Line */}
        <div className="absolute h-full w-[1px] bg-emerald-500/80" />

        {/* Center Chevron Aiming Reticle (PSO-1 style) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-emerald-400" />
        </div>

        {/* Mil-Dots / Drop Compensation Marks */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pt-3">
          <div className="w-3 h-[1px] bg-emerald-400/70" />
          <div className="w-4 h-[1px] bg-emerald-400/70" />
          <div className="w-6 h-[1px] bg-emerald-400/70" />
          <div className="w-8 h-[1px] bg-emerald-400/70" />
        </div>

        {/* Windage Ticks Left & Right */}
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 flex items-center gap-6 -ml-36">
          <div className="h-2 w-[1px] bg-emerald-400/60" />
          <div className="h-3 w-[1px] bg-emerald-400/60" />
          <div className="h-2 w-[1px] bg-emerald-400/60" />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 flex items-center gap-6 ml-16">
          <div className="h-2 w-[1px] bg-emerald-400/60" />
          <div className="h-3 w-[1px] bg-emerald-400/60" />
          <div className="h-2 w-[1px] bg-emerald-400/60" />
        </div>

        {/* PSO-1 Rangefinder Stadiametric Curve (Bottom Left) */}
        <div className="absolute bottom-16 left-16 text-[10px] text-emerald-400/70 font-mono">
          <div className="text-[9px] tracking-wider mb-1">1.7m TARGET</div>
          <div className="flex items-end gap-2 h-8 border-b border-emerald-500/60">
            <span className="text-[8px]">10</span>
            <span className="text-[8px]">8</span>
            <span className="text-[8px]">6</span>
            <span className="text-[8px]">4</span>
            <span className="text-[8px]">2</span>
          </div>
        </div>

        {/* Scope Telemetry Data */}
        <div className="absolute top-10 right-16 text-right font-mono text-[10px] text-emerald-400/70">
          <div>MAG: 4.0X</div>
          <div>OPTIC: PSO-1M2</div>
          <div>ELEV: +0.25 MIL</div>
        </div>
      </div>
    </div>
  );
};
