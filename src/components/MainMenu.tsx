import React, { useEffect, useState } from 'react';
import {
  Shield,
  Play,
  Sliders,
  HelpCircle,
  Lock,
  Unlock,
  Star,
  Crosshair,
  MapPin,
  Clock,
  CheckCircle2,
  Sun,
  Moon,
  Sunrise,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { soundManager } from '../audio/SoundManager';
import {
  CAMPAIGN_MISSIONS,
  CampaignProgressRecord,
  MissionDefinition,
  MissionId,
} from '../types/game';

interface MainMenuProps {
  campaignProgress: CampaignProgressRecord;
  selectedMissionId: MissionId;
  onSelectMission: (id: MissionId) => void;
  onLaunchMission: (id: MissionId) => void;
  onOpenSettings: () => void;
  onToggleUnlockAll?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  campaignProgress,
  selectedMissionId,
  onSelectMission,
  onLaunchMission,
  onOpenSettings,
}) => {
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [unlockAll, setUnlockAll] = useState(false);
  const [deployingId, setDeployingId] = useState<MissionId | null>(null);

  const selectedMission =
    CAMPAIGN_MISSIONS.find((m) => m.id === selectedMissionId) || CAMPAIGN_MISSIONS[0];

  const isMissionUnlocked = (mId: MissionId) => {
    if (mId === 'mission_01') return true;
    if (unlockAll) return true;
    return campaignProgress[mId]?.unlocked ?? false;
  };

  const handleMissionSelect = (m: MissionDefinition) => {
    soundManager.playMissionSelect();
    onSelectMission(m.id);
  };

  const handleDirectLaunch = (missionId: MissionId) => {
    soundManager.playUiClick();
    setDeployingId(missionId);
    setTimeout(() => {
      onLaunchMission(missionId);
    }, 120);
  };

  // Keyboard shortcut: Press Enter or Space to deploy the selected mission
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showControlsHelp) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (isMissionUnlocked(selectedMission.id)) {
          handleDirectLaunch(selectedMission.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMission.id, showControlsHelp, unlockAll]);

  const getTimeIcon = (env: string) => {
    if (env === 'daylight_radar') return <Sun className="w-4 h-4 text-amber-400" />;
    if (env === 'mountain_dawn') return <Sunrise className="w-4 h-4 text-orange-400" />;
    return <Moon className="w-4 h-4 text-sky-400" />;
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-950 text-slate-200 select-none font-mono flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
      {/* Background Cold War Tactical Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />

      {/* 1. Header Bar */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-950/80 border border-emerald-600 rounded">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-bold tracking-widest text-emerald-300">
                PROJECT I.G.I. // TACTICAL COMMAND
              </span>
              <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-800/80 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                TOP SECRET
              </span>
            </div>
            <div className="text-xs text-emerald-600/90 tracking-wider">
              INSTITUTE FOR GEOTACTICAL INTELLIGENCE · SATELLITE RECON OPS
            </div>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Quick Override to unlock all operations for easy testing */}
          <button
            onClick={() => {
              soundManager.playUiClick();
              setUnlockAll(!unlockAll);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs transition border cursor-pointer ${
              unlockAll
                ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-md shadow-amber-950/60'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Agent Clearance to unlock all 3 operations immediately"
          >
            {unlockAll ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
            <span className="font-bold">{unlockAll ? 'ALL OPS UNLOCKED' : 'AGENT CLEARANCE'}</span>
          </button>

          <button
            onClick={() => {
              soundManager.playUiClick();
              setShowControlsHelp(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>FIELD MANUAL</span>
          </button>
          <button
            onClick={() => {
              soundManager.playUiClick();
              onOpenSettings();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>SETTINGS</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Grid: Level Indexer (Left) & Mission Dossier (Right) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 flex-1 items-stretch">
        {/* Left Column: Level Indexer Roster (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between text-xs text-emerald-500 font-bold tracking-wider px-1">
            <span>OPERATIONAL CAMPAIGN ROSTER</span>
            <span>INDEX [3 OPERATIONS]</span>
          </div>

          <div className="space-y-3 flex-1">
            {CAMPAIGN_MISSIONS.map((m) => {
              const p = campaignProgress[m.id];
              const isSelected = m.id === selectedMission.id;
              const isUnlocked = isMissionUnlocked(m.id);
              const isDeploying = deployingId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (!isUnlocked) {
                      soundManager.playDryFire();
                      return;
                    }
                    if (isSelected) {
                      // Clicking an already selected mission card immediately launches it!
                      handleDirectLaunch(m.id);
                    } else {
                      handleMissionSelect(m);
                    }
                  }}
                  onDoubleClick={() => {
                    if (isUnlocked) {
                      handleDirectLaunch(m.id);
                    }
                  }}
                  className={`relative p-4 rounded border transition-all cursor-pointer ${
                    !isUnlocked
                      ? 'bg-slate-950/70 border-slate-800/90 opacity-75'
                      : isSelected
                      ? 'bg-emerald-950/50 border-emerald-400 shadow-xl shadow-emerald-950/60 ring-1 ring-emerald-500/50'
                      : 'bg-slate-900/70 border-slate-800 hover:border-emerald-600/80 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500">
                          {String(m.index).padStart(2, '0')}.
                        </span>
                        <h3
                          className={`text-sm font-bold tracking-wider ${
                            isSelected ? 'text-emerald-300' : 'text-slate-200'
                          }`}
                        >
                          {m.codeName}
                        </h3>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{m.title}</div>
                    </div>

                    {/* Lock or Rating Stars */}
                    {isUnlocked ? (
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3].map((starIdx) => (
                          <Star
                            key={starIdx}
                            className={`w-3.5 h-3.5 ${
                              starIdx <= (p?.stars || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs bg-black/40 px-2 py-0.5 rounded border border-slate-800">
                        <Lock className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-400/90 font-semibold">LOCKED</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      {getTimeIcon(m.environment)}
                      <span>{m.timeOfDay}</span>
                    </div>
                    <div>·</div>
                    <div className="truncate">{m.location}</div>
                  </div>

                  {/* Direct Launch / Action Area on Card */}
                  {isUnlocked ? (
                    <div className="mt-3 pt-2 border-t border-emerald-950 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-emerald-400/80">
                        {isSelected ? '● CURRENTLY SELECTED' : 'CLICK TO SELECT & PREVIEW'}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectLaunch(m.id);
                        }}
                        disabled={isDeploying}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition cursor-pointer shadow-md ${
                          isSelected
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-900/50 hover:scale-[1.03]'
                            : 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/60'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{isDeploying ? 'DEPLOYING...' : isSelected ? 'DEPLOY OPERATION ▶' : 'DEPLOY NOW'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Requires Operation {m.index - 1} clearance</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundManager.playUiClick();
                          setUnlockAll(true);
                          onSelectMission(m.id);
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>OVERRIDE LOCK</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tactical Instruction Guide */}
          <div className="text-[11px] text-slate-400 bg-slate-900/50 p-3 rounded border border-slate-800/70 flex items-center justify-between">
            <span>Click any operation card or press <strong className="text-emerald-400">ENTER / SPACE</strong> to deploy.</span>
            <span className="text-emerald-500 font-bold">READY</span>
          </div>
        </div>

        {/* Right Column: Mission Dossier (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded p-6 flex flex-col justify-between shadow-2xl">
          <div className="space-y-5">
            {/* Dossier Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[11px] text-emerald-500 font-bold tracking-wider">
                  TACTICAL DOSSIER // {selectedMission.codeName}
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide mt-0.5">
                  {selectedMission.title} — {selectedMission.subtitle}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">THREAT LEVEL:</span>
                <span className="text-amber-400 font-bold bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                  {selectedMission.threatLevel}
                </span>
              </div>
            </div>

            {/* Satellite Recon Snapshot Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/40 p-3.5 rounded border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-400">TARGET GRID:</span>
                <span className="font-semibold">{selectedMission.location}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-400">ATMOSPHERE:</span>
                <span className="font-semibold">{selectedMission.weather}</span>
              </div>
            </div>

            {/* Mission Overview Prose */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                OPERATIONAL SUMMARY
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded border border-slate-800/60">
                {selectedMission.dossierSummary}
              </p>
            </div>

            {/* Primary & Secondary Objectives */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-emerald-400 tracking-wider">
                TACTICAL OBJECTIVES
              </div>
              <div className="space-y-2">
                {selectedMission.primaryObjectives.map((obj, idx) => (
                  <div
                    key={obj.id}
                    className="flex items-start gap-2.5 p-2 bg-black/30 rounded border border-emerald-950 text-xs"
                  >
                    <Crosshair className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-200">
                        {idx + 1}. {obj.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{obj.description}</div>
                    </div>
                  </div>
                ))}
                {selectedMission.secondaryObjectives.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-start gap-2.5 p-2 bg-black/30 rounded border border-slate-800 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-200">
                        OPTIONAL: {obj.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{obj.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tactical Intel Notes */}
            <div className="bg-emerald-950/20 border border-emerald-900/60 p-3 rounded text-xs space-y-1">
              <div className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider">
                FIELD RECON INTEL
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-300/80">
                {selectedMission.briefingNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Launch Bar */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="text-xs text-slate-400">
              OPERATIVE LOADOUT: <span className="text-slate-200 font-bold">M9SD · AK-74M · SVD · COMBAT KNIFE</span>
            </div>

            <button
              onClick={() => handleDirectLaunch(selectedMission.id)}
              disabled={deployingId !== null}
              className="flex items-center gap-2.5 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold tracking-widest text-xs uppercase rounded transition cursor-pointer shadow-xl shadow-emerald-950/80 hover:shadow-emerald-500/30 ring-1 ring-emerald-400"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{deployingId === selectedMission.id ? 'DEPLOYING INFILTRATOR...' : 'DEPLOY OPERATIVE [ENTER]'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Field Controls Modal */}
      {showControlsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-xl bg-stone-950 border border-emerald-700/80 rounded p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-900 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-emerald-300 tracking-wider">
                  FIELD MANUAL // OPERATIONAL CONTROLS
                </h3>
              </div>
              <button
                onClick={() => setShowControlsHelp(false)}
                className="text-slate-400 hover:text-white cursor-pointer px-2 py-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">W, A, S, D</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Tactical Movement</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Left Shift</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Sprint (Loud noise signature)</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Ctrl / C</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Crouch (Quiet stealth posture)</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Space</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Jump / Vault Obstacles</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Q / E</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Lean Left (Q) / Lean Right (E)</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">F</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Interact & Hack (Hold 1.5s to Extract)</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Left Click</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Fire Weapon / Strike</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Right Click</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Aim Down Sights / Sniper Scope</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">N</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Night Vision Goggles (NVG)</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">B</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Tactical Binoculars & Recon Tagging</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">1, 2, 3, 4</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Knife / M9SD / AK-74M / Sniper</div>
              </div>
              <div className="p-2.5 bg-black/50 rounded border border-slate-800">
                <strong className="text-emerald-400">Tab / M / Esc</strong>
                <div className="text-[11px] text-slate-400 mt-0.5">Satellite PDA Map / Pause & Settings</div>
              </div>
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowControlsHelp(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded transition cursor-pointer"
              >
                ACKNOWLEDGED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Footer */}
      <footer className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-900 pt-3">
        <div>PROJECT I.G.I. REMAKE · WEBGL 3D TACTICAL SIMULATION</div>
        <div>AUTHORIZED AGENT ACCESS ONLY · SECURITY LEVEL 5</div>
      </footer>
    </div>
  );
};
