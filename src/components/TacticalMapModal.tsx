import React from 'react';
import { X, ShieldAlert, CheckCircle2, Circle, Radio, Crosshair } from 'lucide-react';
import { EnemyData, MissionObjective } from '../types/game';

interface TacticalMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerPos: [number, number, number];
  heading: number;
  enemies: EnemyData[];
  objectives: MissionObjective[];
  baseAlarmActive: boolean;
}

export const TacticalMapModal: React.FC<TacticalMapModalProps> = ({
  isOpen,
  onClose,
  playerPos,
  heading,
  enemies,
  objectives,
  baseAlarmActive,
}) => {
  if (!isOpen) return null;

  // Convert 3D world coordinates [-70, 70] to 2D SVG map coordinates [0, 400]
  const toMapCoord = (x: number, z: number): [number, number] => {
    const mapSize = 400;
    const worldExtent = 140; // compound size
    const mapX = ((x + worldExtent / 2) / worldExtent) * mapSize;
    const mapY = ((z + worldExtent / 2) / worldExtent) * mapSize;
    return [Math.max(10, Math.min(390, mapX)), Math.max(10, Math.min(390, mapY))];
  };

  const [px, py] = toMapCoord(playerPos[0], playerPos[2]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none font-mono text-emerald-400">
      <div className="relative w-full max-w-4xl bg-stone-950 border-2 border-emerald-600/80 rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-emerald-950/60 border-b border-emerald-800/80">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <h2 className="text-base font-bold tracking-widest text-emerald-300">
                TACTICAL SATELLITE RECONNAISSANCE // I.G.I. PDA-4
              </h2>
              <div className="text-[10px] text-emerald-600">
                ORBITAL PASS: KH-11 KENNAN // GRID SECTOR 42-BRAVO // REAL-TIME GPS LINK
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-emerald-900/60 text-emerald-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 overflow-y-auto">
          {/* Left 2 Cols: Interactive Topo Satellite Map */}
          <div className="md:col-span-2 flex flex-col items-center bg-black/90 p-3 rounded border border-emerald-900/80 relative">
            <div className="w-full flex justify-between text-[10px] text-emerald-600 mb-2">
              <span>LAT: 56°14&apos;N // LONG: 38°08&apos;E</span>
              <span className={baseAlarmActive ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400'}>
                {baseAlarmActive ? 'ALARM: CRITICAL' : 'ALARM: SILENCED'}
              </span>
            </div>

            {/* SVG Tactical Map */}
            <div className="relative w-full aspect-square max-w-[420px] bg-slate-950 border border-emerald-800/60 rounded overflow-hidden">
              <svg viewBox="0 0 400 400" className="w-full h-full">
                {/* Background Grid Lines */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#064e3b" strokeWidth="0.5" opacity="0.6" />
                  </pattern>
                </defs>
                <rect width="400" height="400" fill="url(#grid)" />

                {/* Perimeter Wall Outline */}
                <rect x="20" y="20" width="360" height="360" fill="none" stroke="#10b981" strokeWidth="2.5" />
                {/* South Gate opening */}
                <line x1="175" y1="380" x2="225" y2="380" stroke="#000" strokeWidth="5" />
                <line x1="175" y1="380" x2="225" y2="380" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 2" />

                {/* Watchtower 1 (SE) */}
                <rect x="315" y="315" width="28" height="28" fill="#064e3b" stroke="#34d399" strokeWidth="1" />
                <text x="317" y="333" fill="#a7f3d0" fontSize="8" fontFamily="monospace">TWR 1</text>

                {/* Watchtower 2 (NW) */}
                <rect x="57" y="57" width="28" height="28" fill="#064e3b" stroke="#34d399" strokeWidth="1" />
                <text x="59" y="75" fill="#a7f3d0" fontSize="8" fontFamily="monospace">TWR 2</text>

                {/* Large Military Warehouse */}
                <rect x="65" y="145" width="85" height="115" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                <text x="75" y="205" fill="#d1fae5" fontSize="9" fontWeight="bold" fontFamily="monospace">WAREHOUSE</text>
                {/* Intel Briefcase icon in warehouse */}
                <circle cx="108" cy="225" r="5" fill="#38bdf8" />
                <text x="116" y="228" fill="#38bdf8" fontSize="8" fontFamily="monospace">INTEL</text>

                {/* Administrative Brick Outpost */}
                <rect x="250" y="140" width="60" height="70" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="256" y="175" fill="#fef3c7" fontSize="8" fontWeight="bold" fontFamily="monospace">ADMIN HQ</text>
                {/* Alarm Terminal icon */}
                <circle cx="280" cy="188" r="5" fill="#ef4444" />
                <text x="288" y="191" fill="#ef4444" fontSize="8" fontFamily="monospace">ALARM</text>

                {/* Helipad Extraction Zone */}
                <circle cx="200" cy="62" r="28" fill="none" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="194" y="66" fill="#eab308" fontSize="14" fontWeight="bold" fontFamily="monospace">H</text>
                <text x="175" y="48" fill="#eab308" fontSize="8" fontFamily="monospace">EXTRACTION</text>

                {/* Enemy Guard Radar Blips */}
                {enemies.map((e) => {
                  const [ex, ey] = toMapCoord(e.position[0], e.position[2]);
                  const isCombat = e.alertState === 'combat';
                  const isSuspicious = e.alertState === 'suspicious' || e.alertState === 'investigating';
                  const isDead = e.alertState === 'dead';

                  if (isDead) {
                    return (
                      <g key={e.id}>
                        <line x1={ex - 3} y1={ey - 3} x2={ex + 3} y2={ey + 3} stroke="#64748b" strokeWidth="1.5" />
                        <line x1={ex + 3} y1={ey - 3} x2={ex - 3} y2={ey + 3} stroke="#64748b" strokeWidth="1.5" />
                      </g>
                    );
                  }

                  const fillColor = isCombat ? '#ef4444' : isSuspicious ? '#eab308' : '#22c55e';

                  return (
                    <g key={e.id}>
                      <circle cx={ex} cy={ey} r={isCombat ? 5 : 4} fill={fillColor} />
                      {isCombat && <circle cx={ex} cy={ey} r="8" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping" />}
                    </g>
                  );
                })}

                {/* Player Marker (Cyan Triangle with Heading Cone) */}
                <g transform={`translate(${px}, ${py}) rotate(${heading})`}>
                  {/* Vision Cone */}
                  <path d="M 0 0 L -25 -50 L 25 -50 Z" fill="#38bdf8" fillOpacity="0.2" />
                  {/* Player Arrow */}
                  <polygon points="0,-7 6,6 0,2 -6,6" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
                </g>
              </svg>

              {/* Map Legend */}
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 text-[9px] bg-black/80 px-2 py-1 rounded border border-emerald-900/60">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> YOU
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> GUARD
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> COMBAT
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> EXTRACTION
                </span>
              </div>
            </div>
          </div>

          {/* Right Col: Mission Objectives & Status */}
          <div className="flex flex-col gap-4">
            {/* Mission Objective Checklist */}
            <div className="bg-black/70 p-4 rounded border border-emerald-900/80 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                <span className="font-bold text-xs tracking-wider text-emerald-300">DIRECTIVES</span>
                <span className="text-[10px] text-emerald-500">MISSION 1 // ISR</span>
              </div>

              <div className="flex flex-col gap-3">
                {objectives.map((obj) => (
                  <div key={obj.id} className="flex items-start gap-2 text-xs">
                    {obj.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className={obj.isCompleted ? 'line-through text-emerald-600 font-bold' : 'text-emerald-200 font-bold'}>
                        {obj.title} {obj.isOptional && <span className="text-[9px] text-emerald-600">(OPTIONAL)</span>}
                      </span>
                      <span className="text-[10px] text-emerald-600 leading-tight mt-0.5">{obj.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tactical Intel Box */}
            <div className="bg-black/70 p-4 rounded border border-emerald-900/80 flex flex-col gap-2 text-[11px]">
              <div className="flex items-center gap-2 text-emerald-300 font-bold border-b border-emerald-900/60 pb-1">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>TACTICAL BRIEFING NOTES</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-emerald-500 text-[10px]">
                <li>Crouching (C) cuts visibility and completely mutes footsteps.</li>
                <li>Sprinting (Shift) triggers audio alerts up to 16m away.</li>
                <li>The M9SD Silenced Handgun allows quiet headshots.</li>
                <li>Surveillance cameras can be shot out or snuck under.</li>
                <li>Shooting red fuel drums creates explosive distractions.</li>
              </ul>
            </div>

            {/* Resume Button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-black font-bold tracking-widest text-xs uppercase rounded transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              <Crosshair className="w-4 h-4" />
              <span>RETURN TO COMBAT [TAB]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
