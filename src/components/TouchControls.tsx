import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Flame,
  RotateCw,
  Bomb,
  Zap,
  Hand,
  Eye,
  Binoculars,
  ArrowUp,
  Shield,
  Map,
  Pause,
} from 'lucide-react';
import type { InputSystem } from '../game/systems/InputSystem';

export interface TouchControlsProps {
  inputSystem: InputSystem | null;
  isAiming: boolean;
  isCrouching?: boolean;
  isNightVision: boolean;
  isBinoculars: boolean;
  c4Planted?: boolean;
  onOpenMap: () => void;
  onPause: () => void;
}

const STICK_RADIUS = 52;

export const TouchControls: React.FC<TouchControlsProps> = ({
  inputSystem,
  isAiming,
  isCrouching = false,
  isNightVision,
  isBinoculars,
  c4Planted = false,
  onOpenMap,
  onPause,
}) => {
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSprintingStick, setIsSprintingStick] = useState(false);
  const [isFiring, setIsFiring] = useState(false);

  const stickZoneRef = useRef<HTMLDivElement>(null);
  const stickTouchIdRef = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickPointerDownRef = useRef(false);

  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookPointerDownRef = useRef(false);

  useEffect(() => {
    const onFirstTouch = () => {
      setTouchEnabled(true);
    };
    window.addEventListener('touchstart', onFirstTouch, { passive: true, once: true });
    return () => window.removeEventListener('touchstart', onFirstTouch);
  }, []);

  useEffect(() => {
    if (!touchEnabled && inputSystem) {
      inputSystem.resetVirtual();
    }
  }, [touchEnabled, inputSystem]);

  const updateStickVector = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenterRef.current.x;
    const dy = clientY - stickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const offsetX = Math.cos(angle) * clampedDist;
    const offsetY = Math.sin(angle) * clampedDist;

    setStickOffset({ x: offsetX, y: offsetY });

    const normX = offsetX / STICK_RADIUS;
    const normY = -offsetY / STICK_RADIUS;
    const sprint = dist > STICK_RADIUS * 0.82 && normY > 0.35;
    setIsSprintingStick(sprint);

    inputSystem?.setVirtual({
      moveX: Math.abs(normX) < 0.08 ? 0 : normX,
      moveY: Math.abs(normY) < 0.08 ? 0 : normY,
      sprint,
    });
  };

  const resetStick = () => {
    stickTouchIdRef.current = null;
    stickPointerDownRef.current = false;
    setStickOffset({ x: 0, y: 0 });
    setIsSprintingStick(false);
    inputSystem?.setVirtual({ moveX: 0, moveY: 0, sprint: false });
  };

  const handleStickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch || !stickZoneRef.current) return;
    const rect = stickZoneRef.current.getBoundingClientRect();
    stickTouchIdRef.current = touch.identifier;
    stickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateStickVector(touch.clientX, touch.clientY);
  };

  const handleStickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === stickTouchIdRef.current) {
        updateStickVector(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleStickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickTouchIdRef.current) {
        resetStick();
        break;
      }
    }
  };

  const handleStickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!stickZoneRef.current) return;
    const rect = stickZoneRef.current.getBoundingClientRect();
    stickPointerDownRef.current = true;
    stickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateStickVector(e.clientX, e.clientY);
  };

  const handleStickMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stickPointerDownRef.current) return;
    updateStickVector(e.clientX, e.clientY);
  };

  const handleStickMouseUp = () => {
    if (!stickPointerDownRef.current) return;
    resetStick();
  };

  const handleLookTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    lookTouchIdRef.current = touch.identifier;
    lookLastPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        const dx = t.clientX - lookLastPosRef.current.x;
        const dy = t.clientY - lookLastPosRef.current.y;
        lookLastPosRef.current = { x: t.clientX, y: t.clientY };
        inputSystem?.addLook(dx, dy, 1.6);
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  const handleLookMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    lookPointerDownRef.current = true;
    lookLastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!lookPointerDownRef.current) return;
    const dx = e.clientX - lookLastPosRef.current.x;
    const dy = e.clientY - lookLastPosRef.current.y;
    lookLastPosRef.current = { x: e.clientX, y: e.clientY };
    inputSystem?.addLook(dx, dy, 1.6);
  };

  const handleLookMouseUp = () => {
    lookPointerDownRef.current = false;
  };

  const startFire = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setIsFiring(true);
    inputSystem?.setVirtual({ fire: true });
    inputSystem?.trigger('firePress');
  };

  const stopFire = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setIsFiring(false);
    inputSystem?.setVirtual({ fire: false });
  };

  const toggleAim = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    inputSystem?.setVirtual({ aim: !isAiming });
  };

  const startJump = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    inputSystem?.setVirtual({ jump: true });
  };

  const stopJump = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    inputSystem?.setVirtual({ jump: false });
  };

  const startInteract = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    inputSystem?.setVirtual({ interact: true });
    inputSystem?.trigger('interact');
  };

  const stopInteract = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    inputSystem?.setVirtual({ interact: false });
    inputSystem?.trigger('interactRelease');
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none font-mono">
      {/* Subtle Top-Right Toggle Pill for Hybrid/Mobile Controls */}
      <div className="fixed top-2 left-2 z-40 pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Toggle Touch Controls"
          onClick={() => setTouchEnabled((prev) => !prev)}
          className={`px-2.5 py-1 rounded border text-[10px] font-bold tracking-wider uppercase transition cursor-pointer backdrop-blur-xs ${
            touchEnabled
              ? 'bg-emerald-600/90 border-emerald-300 text-black shadow-md shadow-emerald-950/60'
              : 'bg-black/65 border-emerald-900/80 text-emerald-400/80 hover:text-emerald-200 hover:border-emerald-500'
          }`}
        >
          TOUCH HUD: {touchEnabled ? 'ON' : 'OFF'}
        </button>

        {touchEnabled && (
          <>
            <button
              type="button"
              aria-label="Pause Mission"
              onClick={onPause}
              className="p-1.5 rounded bg-black/75 border border-emerald-700/80 text-emerald-300 active:bg-emerald-700 active:text-black cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Open Tactical Map"
              onClick={onOpenMap}
              className="p-1.5 rounded bg-black/75 border border-emerald-700/80 text-emerald-300 active:bg-emerald-700 active:text-black cursor-pointer"
            >
              <Map className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Toggle Night Vision"
              onClick={() => inputSystem?.trigger('nightVision')}
              className={`p-1.5 rounded border cursor-pointer ${
                isNightVision
                  ? 'bg-emerald-500 border-emerald-200 text-black'
                  : 'bg-black/75 border-emerald-700/80 text-emerald-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Toggle Reconnaissance Binoculars"
              onClick={() => inputSystem?.trigger('binoculars')}
              className={`p-1.5 rounded border cursor-pointer ${
                isBinoculars
                  ? 'bg-emerald-500 border-emerald-200 text-black'
                  : 'bg-black/75 border-emerald-700/80 text-emerald-300'
              }`}
            >
              <Binoculars className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {touchEnabled && (
        <>
          {/* Right-Side Touch-Drag Look Pad */}
          <div
            aria-label="Touch Look Pad"
            onTouchStart={handleLookTouchStart}
            onTouchMove={handleLookTouchMove}
            onTouchEnd={handleLookTouchEnd}
            onTouchCancel={handleLookTouchEnd}
            onMouseDown={handleLookMouseDown}
            onMouseMove={handleLookMouseMove}
            onMouseUp={handleLookMouseUp}
            onMouseLeave={handleLookMouseUp}
            className="fixed top-14 right-0 bottom-0 w-1/2 pointer-events-auto touch-none"
          />

          {/* Left Thumb Virtual Analog Stick */}
          <div
            ref={stickZoneRef}
            aria-label="Virtual Movement Joystick"
            onTouchStart={handleStickTouchStart}
            onTouchMove={handleStickTouchMove}
            onTouchEnd={handleStickTouchEnd}
            onTouchCancel={handleStickTouchEnd}
            onMouseDown={handleStickMouseDown}
            onMouseMove={handleStickMouseMove}
            onMouseUp={handleStickMouseUp}
            onMouseLeave={handleStickMouseUp}
            className={`fixed bottom-8 left-6 w-32 h-32 rounded-full border-2 pointer-events-auto touch-none flex items-center justify-center backdrop-blur-xs transition-colors ${
              isSprintingStick
                ? 'bg-amber-950/35 border-amber-400/80 shadow-lg shadow-amber-950/40'
                : 'bg-black/45 border-emerald-500/60 shadow-lg shadow-black/60'
            }`}
          >
            {/* Outer Sprint Ring Indicator */}
            <div className="w-24 h-24 rounded-full border border-dashed border-emerald-500/30 pointer-events-none flex items-center justify-center">
              <span className="text-[8px] tracking-widest text-emerald-500/60 uppercase">
                {isSprintingStick ? 'SPRINT' : 'MOVE'}
              </span>
            </div>

            {/* Thumb Stick Knob */}
            <div
              className={`absolute w-12 h-12 rounded-full border-2 pointer-events-none transition-transform duration-75 flex items-center justify-center ${
                isSprintingStick
                  ? 'bg-amber-500/80 border-amber-200 text-black'
                  : 'bg-emerald-500/75 border-emerald-200 text-black'
              }`}
              style={{
                transform: `translate(${stickOffset.x.toFixed(1)}px, ${stickOffset.y.toFixed(1)}px)`,
              }}
            >
              <div className="w-3 h-3 rounded-full bg-black/50" />
            </div>
          </div>

          {/* Right Thumb Tactical Action Cluster */}
          <div className="fixed bottom-6 right-5 pointer-events-auto flex flex-col items-end gap-2.5 touch-none">
            {/* Upper Row: Utility & Ordnance Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Cycle Next Weapon"
                onClick={(e) => {
                  e.stopPropagation();
                  inputSystem?.trigger('weaponNext');
                }}
                className="px-2.5 py-2 rounded-lg bg-black/75 border border-emerald-500/70 text-emerald-300 text-[10px] font-bold tracking-wider uppercase active:bg-emerald-500 active:text-black cursor-pointer"
              >
                NEXT WPN
              </button>

              <button
                type="button"
                aria-label="Throw Frag Grenade"
                onClick={(e) => {
                  e.stopPropagation();
                  inputSystem?.trigger('grenade');
                }}
                className="w-11 h-11 rounded-full bg-black/75 border border-amber-500/80 text-amber-300 flex flex-col items-center justify-center active:bg-amber-500 active:text-black cursor-pointer"
              >
                <Bomb className="w-4 h-4" />
                <span className="text-[8px] font-bold">FRAG</span>
              </button>

              <button
                type="button"
                aria-label={c4Planted ? 'Detonate C4 Charge' : 'Plant C4 Charge'}
                onClick={(e) => {
                  e.stopPropagation();
                  inputSystem?.trigger('gadget');
                }}
                className={`w-11 h-11 rounded-full border flex flex-col items-center justify-center cursor-pointer ${
                  c4Planted
                    ? 'bg-red-600/90 border-red-200 text-white animate-pulse'
                    : 'bg-black/75 border-cyan-500/80 text-cyan-300 active:bg-cyan-500 active:text-black'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="text-[8px] font-bold">{c4Planted ? 'DET' : 'C4'}</span>
              </button>
            </div>

            {/* Middle Row: Interact, Reload, Crouch, Jump */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Interact or Use Object"
                onTouchStart={startInteract}
                onTouchEnd={stopInteract}
                onTouchCancel={stopInteract}
                onMouseDown={startInteract}
                onMouseUp={stopInteract}
                onMouseLeave={stopInteract}
                className="w-11 h-11 rounded-full bg-black/75 border border-yellow-500/80 text-yellow-300 flex flex-col items-center justify-center active:bg-yellow-400 active:text-black cursor-pointer"
              >
                <Hand className="w-4 h-4" />
                <span className="text-[8px] font-bold">USE</span>
              </button>

              <button
                type="button"
                aria-label="Reload Weapon"
                onClick={(e) => {
                  e.stopPropagation();
                  inputSystem?.trigger('reload');
                }}
                className="w-11 h-11 rounded-full bg-black/75 border border-emerald-500/80 text-emerald-300 flex flex-col items-center justify-center active:bg-emerald-500 active:text-black cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[8px] font-bold">RLD</span>
              </button>

              <button
                type="button"
                aria-label="Toggle Crouch Posture"
                onClick={(e) => {
                  e.stopPropagation();
                  inputSystem?.trigger('crouch');
                }}
                className={`w-11 h-11 rounded-full border flex flex-col items-center justify-center cursor-pointer ${
                  isCrouching
                    ? 'bg-emerald-600/90 border-emerald-200 text-black font-bold'
                    : 'bg-black/75 border-emerald-500/80 text-emerald-300 active:bg-emerald-500 active:text-black'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="text-[8px] font-bold">CRCH</span>
              </button>

              <button
                type="button"
                aria-label="Jump or Climb"
                onTouchStart={startJump}
                onTouchEnd={stopJump}
                onTouchCancel={stopJump}
                onMouseDown={startJump}
                onMouseUp={stopJump}
                onMouseLeave={stopJump}
                className="w-11 h-11 rounded-full bg-black/75 border border-emerald-500/80 text-emerald-300 flex flex-col items-center justify-center active:bg-emerald-500 active:text-black cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
                <span className="text-[8px] font-bold">JUMP</span>
              </button>
            </div>

            {/* Primary Combat Row: ADS Scope Toggle + Large Fire Trigger */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Toggle Aim Down Sights"
                onClick={toggleAim}
                className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center cursor-pointer transition ${
                  isAiming
                    ? 'bg-emerald-500/90 border-emerald-100 text-black font-bold shadow-lg shadow-emerald-900/60'
                    : 'bg-black/80 border-emerald-400/80 text-emerald-300 active:bg-emerald-600 active:text-black'
                }`}
              >
                <Crosshair className="w-5 h-5" />
                <span className="text-[9px] font-bold">ADS</span>
              </button>

              <button
                type="button"
                aria-label="Fire Weapon"
                onTouchStart={startFire}
                onTouchEnd={stopFire}
                onTouchCancel={stopFire}
                onMouseDown={startFire}
                onMouseUp={stopFire}
                onMouseLeave={stopFire}
                className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center cursor-pointer transition ${
                  isFiring
                    ? 'bg-red-500 border-red-100 text-black scale-95 shadow-xl shadow-red-900/80'
                    : 'bg-red-950/85 border-red-500 text-red-200 shadow-lg shadow-black/80'
                }`}
              >
                <Flame className="w-7 h-7" />
                <span className="text-[10px] font-extrabold tracking-wider">FIRE</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
