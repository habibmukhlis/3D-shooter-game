import React from 'react';
import {
  Shield,
  Heart,
  Zap,
  Crosshair,
  AlertTriangle,
  Radio,
  Eye,
  Volume2,
  Settings,
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  Bomb,
} from 'lucide-react';
import { EnemyData, GameSettings, MissionObjective, WeaponData } from '../types/game';

interface HUDProps {
  health: number;
  armor: number;
  stamina: number;
  currentWeapon: WeaponData;
  weapons: WeaponData[];
  stealthVisibility: number;
  stealthNoise: number;
  compassHeading: number;
  isAiming: boolean;
  isReloading: boolean;
  hitMarker: boolean;
  isHeadshotHit?: boolean;
  damageDirection: number | null;
  baseAlarmActive: boolean;
  objectives: MissionObjective[];
  interactionPrompt: string | null;
  leanOffset: number;
  isNightVision: boolean;
  isBinoculars: boolean;
  taggedEnemies: EnemyData[];
  settings: GameSettings;
  grenades?: number;
  c4Count?: number;
  c4Planted?: boolean;
  powerCut?: boolean;
  fps?: number;
  onOpenTacticalMap: () => void;
  onOpenSettings: () => void;
  onToggleNightVision: () => void;
  onToggleBinoculars: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  health,
  armor,
  stamina,
  currentWeapon,
  weapons,
  stealthVisibility,
  stealthNoise,
  compassHeading,
  isAiming,
  isReloading,
  hitMarker,
  isHeadshotHit = false,
  damageDirection,
  baseAlarmActive,
  objectives,
  interactionPrompt,
  leanOffset,
  isNightVision,
  isBinoculars,
  taggedEnemies,
  settings,
  grenades = 3,
  c4Count = 2,
  c4Planted = false,
  powerCut = false,
  fps = 60,
  onOpenTacticalMap,
  onOpenSettings,
  onToggleNightVision,
  onToggleBinoculars,
}) => {
  const [isPointerLocked, setIsPointerLocked] = React.useState(
    () => typeof document !== 'undefined' && !!document.pointerLockElement
  );
  const [isTouchDevice, setIsTouchDevice] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  React.useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(!!document.pointerLockElement);
    };
    const handleTouchStart = () => {
      setIsTouchDevice(true);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('touchstart', handleTouchStart, { passive: true, once: true });
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  const lowHealthIntensity = Math.max(0, (35 - health) / 35);
  const fragCount = grenades ?? 3;
  const c4Remaining = c4Count ?? 2;

  const cardinalDirections = [
    { label: 'N', deg: 0 },
    { label: 'NE', deg: 45 },
    { label: 'E', deg: 90 },
    { label: 'SE', deg: 135 },
    { label: 'S', deg: 180 },
    { label: 'SW', deg: 225 },
    { label: 'W', deg: 270 },
    { label: 'NW', deg: 315 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-xs text-emerald-400">
      {/* 1. Low Health Red Vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 100px rgba(220, 38, 38, 0.65)',
          opacity: lowHealthIntensity > 0 ? lowHealthIntensity : 0,
        }}
      />

      {/* 2. Directional Damage Arc Indicator */}
      {settings.showDamageIndicators && damageDirection !== null && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-80 h-80 max-sm:w-56 max-sm:h-56 rounded-full border-t-8 border-red-600/80 blur-xs transition-transform duration-100 animate-pulse"
            style={{
              transform: `rotate(${damageDirection}deg)`,
            }}
          />
        </div>
      )}

      {/* 3. Base Siren Flashing Banner when Alarm Active */}
      {baseAlarmActive && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-1.5 max-sm:px-2.5 max-sm:py-1 max-sm:text-[10px] bg-red-950/85 border border-red-500 text-red-300 font-bold tracking-widest uppercase rounded shadow-lg shadow-red-950/50 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce shrink-0" />
          <span>BASE-WIDE ALARM ACTIVE // REINFORCEMENTS ENGAGED</span>
          <Radio className="w-4 h-4 text-red-500 shrink-0 max-sm:hidden" />
        </div>
      )}

      {/* 4. Top Compass Tape + Telemetry Status Row */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div className="w-80 max-sm:w-52 h-10 max-sm:h-8 bg-black/65 border border-emerald-900/60 rounded flex flex-col items-center justify-center backdrop-blur-xs">
          <div className="w-2 h-2 border-b-4 border-l-2 border-r-2 border-emerald-400 -mb-1 rotate-45" />
          <div className="relative w-full h-5 overflow-hidden flex items-center justify-center">
            <div
              className="flex items-center gap-6 text-[11px] max-sm:text-[10px] font-bold tracking-wider transition-transform ease-out duration-75"
              style={{
                transform: `translateX(${((180 - compassHeading) * 2.2).toFixed(1)}px)`,
              }}
            >
              {[-1, 0, 1].map((loop) => (
                <React.Fragment key={loop}>
                  {cardinalDirections.map((d) => (
                    <div key={`${loop}-${d.label}`} className="flex flex-col items-center w-8 text-center shrink-0">
                      <span className={d.label === 'N' ? 'text-red-400 font-extrabold' : 'text-emerald-400/90'}>
                        {d.label}
                      </span>
                      <span className="text-[9px] text-emerald-600">{d.deg}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Top Bar Status Badges: FPS Counter + Grid Power Offline Badge */}
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 bg-black/70 border border-emerald-900/70 rounded text-[10px] text-emerald-400/90 font-semibold tracking-wider">
            {fps ?? 60} FPS
          </div>
          {powerCut && (
            <div className="px-2.5 py-0.5 bg-cyan-950/85 border border-cyan-500/80 rounded text-[10px] text-cyan-300 font-bold tracking-wider flex items-center gap-1 shadow-sm">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>GRID POWER OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      {/* Leaning Indicator */}
      {Math.abs(leanOffset) > 0.1 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/75 border border-emerald-500/60 rounded text-[10px] text-emerald-300 font-bold flex items-center gap-1">
          {leanOffset < 0 ? (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-emerald-400" aria-label="Leaning left" />
              <span>LEANING LEFT [Q]</span>
            </>
          ) : (
            <>
              <span>LEANING RIGHT [E]</span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-400" aria-label="Leaning right" />
            </>
          )}
        </div>
      )}

      {/* 5. Center Dynamic Crosshair (customized by settings) */}
      {!isAiming && !isBinoculars && currentWeapon.id !== 'knife' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          {settings.crosshairStyle === 'classic' && (
            <>
              <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full" />
              <div className="absolute -top-3 w-0.5 h-2 bg-emerald-400/70" />
              <div className="absolute -bottom-3 w-0.5 h-2 bg-emerald-400/70" />
              <div className="absolute -left-3 h-0.5 w-2 bg-emerald-400/70" />
              <div className="absolute -right-3 h-0.5 w-2 bg-emerald-400/70" />
            </>
          )}
          {settings.crosshairStyle === 'dot' && (
            <div className="w-2 h-2 bg-emerald-400 rounded-full border border-black shadow-sm" />
          )}
          {settings.crosshairStyle === 'circle' && (
            <div className="w-5 h-5 border border-emerald-400/80 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-emerald-400 rounded-full" />
            </div>
          )}
        </div>
      )}

      {/* Click to Lock Sights Prompt (Desktop only) */}
      {!isPointerLocked && !isTouchDevice && (
        <div className="max-sm:hidden absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 pointer-events-none flex flex-col items-center gap-1.5 px-4 py-2 bg-black/85 border border-emerald-500/80 rounded shadow-2xl backdrop-blur-xs animate-pulse">
          <div className="flex items-center gap-2 text-emerald-300 font-bold tracking-wider text-xs">
            <Crosshair className="w-4 h-4 text-emerald-400" />
            <span>CLICK SCREEN TO ENGAGE & LOCK SIGHTS</span>
          </div>
          <div className="text-[10px] text-emerald-500">
            MOUSE: LOOK / AIM | LEFT CLICK: FIRE | ESC: MENU
          </div>
        </div>
      )}

      {/* Hitmarker & Gold/Crimson Headshot Flare Confirmation */}
      {hitMarker && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center">
          {isHeadshotHit ? (
            <>
              <div className="w-9 h-9 border-2 border-amber-400 rotate-45 animate-ping opacity-95 shadow-lg shadow-red-600/80" />
              <div className="absolute w-5 h-5 border-2 border-red-500 rotate-45" />
              <span className="mt-7 px-2 py-0.5 rounded bg-red-950/90 border border-amber-400 text-[9px] font-extrabold tracking-widest text-amber-300 uppercase shadow">
                HEADSHOT
              </span>
            </>
          ) : (
            <div className="w-6 h-6 border-2 border-red-500 rotate-45 animate-ping opacity-90" />
          )}
        </div>
      )}

      {/* Tagged Enemy Badges */}
      {taggedEnemies.map((e, idx) => (
        <div
          key={`tag_${e.id}`}
          style={{ top: `${80 + idx * 24}px` }}
          className="absolute right-80 max-sm:right-4 bg-black/70 px-2 py-0.5 border border-red-500/80 rounded text-[10px] text-red-300 flex items-center gap-1"
        >
          <Target className="w-3 h-3 text-red-400" />
          <span>{e.name.toUpperCase()} (ALERT: {e.alertState.toUpperCase()})</span>
        </div>
      ))}

      {/* 6. Contextual Interaction Prompt */}
      {interactionPrompt && (
        <div className="absolute bottom-32 max-sm:bottom-44 left-1/2 -translate-x-1/2 px-4 py-2 max-sm:px-3 max-sm:py-1.5 bg-black/85 border border-yellow-500 text-yellow-300 font-bold tracking-wider rounded backdrop-blur-xs shadow-lg animate-pulse text-sm max-sm:text-xs text-center">
          {interactionPrompt}
        </div>
      )}

      {/* Reloading banner */}
      {isReloading && (
        <div className="absolute bottom-24 max-sm:bottom-36 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/75 border border-emerald-500/80 text-emerald-300 font-bold tracking-widest rounded uppercase">
          RELOADING...
        </div>
      )}

      {/* 7. Bottom Left Status Panel */}
      <div className="absolute bottom-5 left-5 max-sm:bottom-44 max-sm:left-2 w-72 max-sm:w-48 md:w-72 bg-black/70 border border-emerald-950/80 p-3 max-sm:p-2 rounded backdrop-blur-sm shadow-xl flex flex-col gap-2.5 max-sm:gap-1.5">
        <div className="flex justify-between items-center text-[10px] max-sm:text-[9px] text-emerald-500 border-b border-emerald-900/60 pb-1">
          <span className="font-bold tracking-wider truncate">DAVID L. JONES // I.G.I.</span>
          <span className="text-emerald-400 max-sm:hidden">SEC-STATUS: OK</span>
        </div>

        {/* Health Bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[11px] max-sm:text-[10px]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> VITAL SIGNS
            </span>
            <span className={health < 30 ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-300'}>
              {Math.round(health)}%
            </span>
          </div>
          <div className="w-full h-2 max-sm:h-1.5 bg-emerald-950/60 rounded-xs overflow-hidden border border-emerald-900/50">
            <div
              className={`h-full transition-all duration-150 ${
                health > 50 ? 'bg-emerald-500' : health > 25 ? 'bg-yellow-500' : 'bg-red-600'
              }`}
              style={{ width: `${Math.max(0, health)}%` }}
            />
          </div>
        </div>

        {/* Body Armor Bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[11px] max-sm:text-[10px]">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Shield className="w-3.5 h-3.5 text-cyan-400" /> KEVLAR VEST
            </span>
            <span className="text-cyan-300">{Math.round(armor)}%</span>
          </div>
          <div className="w-full h-2 max-sm:h-1.5 bg-cyan-950/60 rounded-xs overflow-hidden border border-cyan-900/50">
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${Math.max(0, armor)}%` }}
            />
          </div>
        </div>

        {/* Stamina Bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] max-sm:text-[9px]">
            <span className="flex items-center gap-1 text-amber-400">
              <Zap className="w-3 h-3 text-amber-400" /> STAMINA
            </span>
            <span className="text-amber-300">{Math.round(stamina)}%</span>
          </div>
          <div className="w-full h-1 bg-amber-950/60 rounded-xs overflow-hidden border border-amber-900/50">
            <div
              className="h-full bg-amber-400 transition-all duration-100"
              style={{ width: `${Math.max(0, stamina)}%` }}
            />
          </div>
        </div>

        {/* Stealth Noise & Visibility Meters */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-900/60">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <div className="text-[9px] text-emerald-500">VISIBILITY</div>
              <div className="w-full h-1.5 bg-emerald-950 rounded-xs overflow-hidden">
                <div
                  className={`h-full ${
                    stealthVisibility > 70 ? 'bg-red-500' : stealthVisibility > 40 ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${stealthVisibility}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <div className="text-[9px] text-emerald-500">NOISE</div>
              <div className="w-full h-1.5 bg-emerald-950 rounded-xs overflow-hidden">
                <div
                  className={`h-full ${
                    stealthNoise > 60 ? 'bg-red-500' : stealthNoise > 20 ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${stealthNoise}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tactical Gear Toggles (NVG & Binoculars) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-900/60 pointer-events-auto max-sm:hidden">
          <button
            type="button"
            aria-label="Toggle Night Vision Goggles"
            onClick={onToggleNightVision}
            className={`py-1 px-2 rounded border text-[10px] cursor-pointer flex items-center justify-center gap-1 transition ${
              isNightVision
                ? 'bg-emerald-600 border-emerald-400 text-black font-bold'
                : 'bg-black/50 border-emerald-900 text-emerald-400 hover:bg-emerald-950'
            }`}
          >
            <span>NVG [N]</span>
          </button>
          <button
            type="button"
            aria-label="Toggle Tactical Binoculars"
            onClick={onToggleBinoculars}
            className={`py-1 px-2 rounded border text-[10px] cursor-pointer flex items-center justify-center gap-1 transition ${
              isBinoculars
                ? 'bg-emerald-600 border-emerald-400 text-black font-bold'
                : 'bg-black/50 border-emerald-900 text-emerald-400 hover:bg-emerald-950'
            }`}
          >
            <span>OPTICS [B]</span>
          </button>
        </div>
      </div>

      {/* 8. Bottom Right Weapon Status, Ordnance & Inventory */}
      <div className="absolute bottom-5 right-5 max-sm:top-12 max-sm:left-2 max-sm:bottom-auto max-sm:right-auto w-72 max-sm:w-48 md:w-72 bg-black/70 border border-emerald-950/80 p-3 max-sm:p-2 rounded backdrop-blur-sm shadow-xl flex flex-col gap-2 max-sm:gap-1.5">
        <div className="flex justify-between items-center border-b border-emerald-900/60 pb-1">
          <span className="font-bold text-sm max-sm:text-xs tracking-wider text-emerald-300 truncate">
            {currentWeapon.name}
          </span>
          <span className="text-[10px] max-sm:text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
            {currentWeapon.isSilenced ? 'SUPPRESSED' : currentWeapon.isAutomatic ? 'AUTO' : 'SEMI'}
          </span>
        </div>

        <div className="flex items-baseline justify-between py-0.5">
          {currentWeapon.id !== 'knife' ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl max-sm:text-xl font-extrabold text-emerald-300 tracking-tighter">
                {currentWeapon.ammo}
              </span>
              <span className="text-sm max-sm:text-xs text-emerald-600 font-semibold">
                / {currentWeapon.reserve}
              </span>
            </div>
          ) : (
            <span className="text-lg max-sm:text-xs font-bold text-emerald-400">MELEE EQUIPPED</span>
          )}
          <span className="text-[10px] text-emerald-500">SLOT [{currentWeapon.slot}]</span>
        </div>

        {/* Tactical Ordnance Counters: Frag Grenades [G] & C4 Charges [X] */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-emerald-900/60 text-[10px]">
          <div className="px-2 py-1 rounded bg-black/50 border border-amber-900/70 flex items-center justify-between">
            <span className="flex items-center gap-1 text-amber-300 font-semibold">
              <Bomb className="w-3 h-3 text-amber-400 shrink-0" />
              <span>FRAG [G]</span>
            </span>
            <span className="font-bold text-amber-200">{fragCount}</span>
          </div>

          <div
            className={`px-2 py-1 rounded border flex items-center justify-between ${
              c4Planted
                ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
                : 'bg-black/50 border-cyan-900/70 text-cyan-300'
            }`}
          >
            {c4Planted ? (
              <span className="font-extrabold tracking-tight text-[9px] text-red-300 truncate">
                ARMED - DETONATE [X]
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1 font-semibold">
                  <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>C4 [X]</span>
                </span>
                <span className="font-bold text-cyan-200">{c4Remaining}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Weapon Slots */}
        <div className="grid grid-cols-5 max-sm:hidden gap-1 pt-1 border-t border-emerald-900/60 text-center">
          {weapons.map((w, idx) => (
            <div
              key={w.id}
              className={`py-1 rounded border text-[9px] flex flex-col items-center ${
                w.id === currentWeapon.id
                  ? 'bg-emerald-900/50 border-emerald-400 text-emerald-200 font-bold'
                  : 'bg-black/40 border-emerald-950 text-emerald-700'
              }`}
            >
              <span className="text-[8px] text-emerald-600">[{idx + 1}]</span>
              <span className="truncate w-full px-0.5">{w.id.split('_')[0].toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 9. Top Right Mission Objectives Tracker & Controls Header */}
      <div className="absolute top-5 right-5 max-sm:top-2 max-sm:right-2 w-76 max-sm:w-52 md:w-76 bg-black/75 border border-emerald-950/80 p-3 max-sm:p-2 rounded backdrop-blur-sm shadow-xl flex flex-col gap-2 max-sm:gap-1 pointer-events-auto">
        <div className="flex justify-between items-center border-b border-emerald-900/60 pb-1">
          <span className="font-bold text-xs max-sm:text-[10px] tracking-wider text-emerald-300">
            MISSION DIRECTIVES
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Open Settings"
              onClick={onOpenSettings}
              className="p-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] cursor-pointer transition"
              title="Settings [ESC]"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Open Tactical Map"
              onClick={onOpenTacticalMap}
              className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] cursor-pointer flex items-center gap-1 transition"
            >
              <Crosshair className="w-3 h-3 text-emerald-400" />
              <span className="max-sm:hidden">MAP [TAB]</span>
              <span className="sm:hidden">MAP</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-sm:gap-1">
          {objectives.map((obj) => (
            <div key={obj.id} className="flex items-start gap-2 text-[11px] max-sm:text-[10px]">
              {obj.isCompleted ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-label="Completed" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-label="Pending" />
              )}
              <span
                className={
                  obj.isCompleted
                    ? 'line-through text-emerald-600'
                    : 'text-emerald-200/90'
                }
              >
                {obj.title} {obj.isOptional && <span className="text-[9px] text-emerald-600">(OPT)</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
