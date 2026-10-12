import React from 'react';
import { Shield, Play, Crosshair, Terminal, Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface MissionBriefingModalProps {
  onStartMission: () => void;
}

export const MissionBriefingModal: React.FC<MissionBriefingModalProps> = ({ onStartMission }) => {
  const [isMuted, setIsMuted] = React.useState(soundManager.getIsMuted());

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setIsMuted(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono select-none text-emerald-400">
      <div className="relative w-full max-w-3xl bg-stone-950 border-2 border-emerald-600/80 rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Classified Top Secret Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-950/70 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] bg-red-900/80 border border-red-500 text-red-200 font-bold rounded">
                  TOP SECRET // CODIFIED
                </span>
                <span className="text-[10px] text-emerald-600">MISSION FILE #ISR-001</span>
              </div>
              <h1 className="text-xl font-bold tracking-wider text-emerald-300">
                PROJECT I.G.I. // OPERATION: TRAINYARD DEPOT
              </h1>
            </div>
          </div>

          <button
            onClick={handleToggleMute}
            className="p-2 rounded bg-black/60 hover:bg-emerald-950 border border-emerald-800/80 text-emerald-400 cursor-pointer transition flex items-center gap-1.5 text-xs"
            title="Toggle Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
          </button>
        </div>

        {/* Dossier Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Situation Brief */}
          <div className="bg-black/60 p-4 rounded border border-emerald-900/80 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>INTELLIGENCE SITUATION REPORT</span>
            </div>
            <p className="text-emerald-500 leading-relaxed text-[11px]">
              Agent David L. Jones, an ex-Soviet military supply base in the Ural mountains has been commandeered by rogue operative Jach Priboi. Our satellite pass confirms heavy garrison patrols, elevated watchtower snipers, and active perimeter surveillance cameras.
            </p>
            <p className="text-emerald-500 leading-relaxed text-[11px]">
              Your objective is clandestine infiltration. Locate the intelligence briefcase inside the main warehouse, sabotage their base-wide alarm terminal, neutralize the snipers, and extract via the north helipad.
            </p>
          </div>

          {/* Loadout & Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Loadout */}
            <div className="bg-black/60 p-4 rounded border border-emerald-900/80 space-y-2">
              <h3 className="font-bold text-emerald-300 text-xs tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-4 h-4" /> WEAPONS LOADOUT
              </h3>
              <div className="space-y-1.5 text-[11px] text-emerald-400">
                <div className="flex justify-between border-b border-emerald-950 pb-1">
                  <span>[1] Ka-Bar Combat Knife</span>
                  <span className="text-emerald-600">Silent Takedown</span>
                </div>
                <div className="flex justify-between border-b border-emerald-950 pb-1">
                  <span>[2] M9SD Silenced 9mm</span>
                  <span className="text-emerald-600">Suppressed Handgun</span>
                </div>
                <div className="flex justify-between border-b border-emerald-950 pb-1">
                  <span>[3] AK-74M Assault Rifle</span>
                  <span className="text-emerald-600">Full Automatic</span>
                </div>
                <div className="flex justify-between">
                  <span>[4] SVD Dragunov Sniper</span>
                  <span className="text-emerald-600">4x Optic Scope</span>
                </div>
              </div>
            </div>

            {/* Tactical Controls */}
            <div className="bg-black/60 p-4 rounded border border-emerald-900/80 space-y-2">
              <h3 className="font-bold text-emerald-300 text-xs tracking-wider">TACTICAL CONTROLS</h3>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-emerald-400">
                <div><strong className="text-emerald-200">WASD:</strong> Movement</div>
                <div><strong className="text-emerald-200">Shift:</strong> Sprint (Loud)</div>
                <div><strong className="text-emerald-200">C / Ctrl:</strong> Crouch (Silent)</div>
                <div><strong className="text-emerald-200">Space:</strong> Jump</div>
                <div><strong className="text-emerald-200">Left-Click:</strong> Fire</div>
                <div><strong className="text-emerald-200">Right-Click:</strong> Aim Sights (ADS)</div>
                <div><strong className="text-emerald-200">R:</strong> Reload</div>
                <div><strong className="text-emerald-200">E:</strong> Interact / Hack</div>
                <div><strong className="text-emerald-200">1-4:</strong> Weapon Slots</div>
                <div><strong className="text-emerald-200">Tab / M:</strong> Satellite Map</div>
              </div>
            </div>
          </div>
        </div>

        {/* Start Button Footer */}
        <div className="p-5 bg-emerald-950/40 border-t border-emerald-900/80 flex items-center justify-between">
          <div className="text-[10px] text-emerald-600">
            CLICK VIEWPORT TO ENGAGE MOUSE LOOK // PRESS ESCAPE TO UNLOCK
          </div>
          <button
            onClick={onStartMission}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold tracking-widest text-sm uppercase rounded transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/80"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>COMMENCE INFILTRATION</span>
          </button>
        </div>
      </div>
    </div>
  );
};
