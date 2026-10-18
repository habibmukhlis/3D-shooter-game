import React, { useEffect, useRef, useState } from 'react';
import { Shield, Radio } from 'lucide-react';
import { AssetLoader } from './game/AssetLoader';
import { GameEngine, HudPayload } from './game/GameEngine';
import {
  CAMPAIGN_MISSIONS,
  CampaignProgressRecord,
  DEFAULT_CAMPAIGN_PROGRESS,
  DEFAULT_SETTINGS,
  GameSettings,
  GameState,
  MissionId,
  MissionProgress,
} from './types/game';
import { HUD } from './components/HUD';
import { TouchControls } from './components/TouchControls';
import { SniperScopeOverlay } from './components/SniperScopeOverlay';
import { TacticalMapModal } from './components/TacticalMapModal';
import { MissionEndModal } from './components/MissionEndModal';
import { SettingsModal } from './components/SettingsModal';
import { NightVisionOverlay } from './components/NightVisionOverlay';
import { BinocularsOverlay } from './components/BinocularsOverlay';
import { MainMenu } from './components/MainMenu';
import { PauseMenu } from './components/PauseMenu';

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.max(min, Math.min(val, max))
    : fallback;
}

function sanitizeSettings(raw: unknown): GameSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const obj = raw as Record<string, unknown>;
  const shadowQuality =
    obj.shadowQuality === 'off' || obj.shadowQuality === 'low' || obj.shadowQuality === 'high'
      ? obj.shadowQuality
      : DEFAULT_SETTINGS.shadowQuality;
  const crosshairStyle =
    obj.crosshairStyle === 'classic' || obj.crosshairStyle === 'dot' || obj.crosshairStyle === 'circle'
      ? obj.crosshairStyle
      : DEFAULT_SETTINGS.crosshairStyle;

  return {
    mouseSensitivity: clampNum(obj.mouseSensitivity, 0.3, 3.0, DEFAULT_SETTINGS.mouseSensitivity),
    invertY: typeof obj.invertY === 'boolean' ? obj.invertY : DEFAULT_SETTINGS.invertY,
    fieldOfView: clampNum(obj.fieldOfView, 65, 105, DEFAULT_SETTINGS.fieldOfView),
    masterVolume: clampNum(obj.masterVolume, 0, 100, DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clampNum(obj.sfxVolume, 0, 100, DEFAULT_SETTINGS.sfxVolume),
    ambientVolume: clampNum(obj.ambientVolume, 0, 100, DEFAULT_SETTINGS.ambientVolume),
    headBobbing: typeof obj.headBobbing === 'boolean' ? obj.headBobbing : DEFAULT_SETTINGS.headBobbing,
    bobIntensity: clampNum(obj.bobIntensity, 0.2, 2.0, DEFAULT_SETTINGS.bobIntensity),
    shadowQuality,
    postProcessing: typeof obj.postProcessing === 'boolean' ? obj.postProcessing : DEFAULT_SETTINGS.postProcessing,
    crosshairStyle,
    showDamageIndicators:
      typeof obj.showDamageIndicators === 'boolean'
        ? obj.showDamageIndicators
        : DEFAULT_SETTINGS.showDamageIndicators,
  };
}

function sanitizeMissionProgress(raw: unknown, fallbackUnlocked: boolean): MissionProgress {
  if (!raw || typeof raw !== 'object') {
    return { unlocked: fallbackUnlocked, completed: false, stars: 0 };
  }
  const obj = raw as Record<string, unknown>;
  return {
    unlocked: fallbackUnlocked || (typeof obj.unlocked === 'boolean' ? obj.unlocked : false),
    completed: typeof obj.completed === 'boolean' ? obj.completed : false,
    stars: clampNum(obj.stars, 0, 3, 0),
    bestTime: typeof obj.bestTime === 'number' && obj.bestTime > 0 ? obj.bestTime : undefined,
    highestAccuracy:
      typeof obj.highestAccuracy === 'number' ? clampNum(obj.highestAccuracy, 0, 100, 0) : undefined,
  };
}

function sanitizeCampaignProgress(raw: unknown): CampaignProgressRecord {
  if (!raw || typeof raw !== 'object') return DEFAULT_CAMPAIGN_PROGRESS;
  const obj = raw as Record<string, unknown>;
  return {
    mission_01: sanitizeMissionProgress(obj.mission_01, true),
    mission_02: sanitizeMissionProgress(obj.mission_02, false),
    mission_03: sanitizeMissionProgress(obj.mission_03, false),
    mission_04: sanitizeMissionProgress(obj.mission_04, false),
  };
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Game States
  const [gameState, setGameState] = useState<GameState>('menu');
  const [selectedMissionId, setSelectedMissionId] = useState<MissionId>('mission_01');
  const [isTacticalMapOpen, setIsTacticalMapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 3D Asset Preloading State
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ percent: number; label: string }>({
    percent: 0,
    label: 'Initializing 3D Asset Pipeline...',
  });

  // Settings State with Validated LocalStorage Persistence
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('igi_game_settings');
      if (saved) return sanitizeSettings(JSON.parse(saved));
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  });

  // Campaign Progress Persistence with Strict Validation
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgressRecord>(() => {
    try {
      const saved = localStorage.getItem('igi_campaign_progress');
      if (saved) return sanitizeCampaignProgress(JSON.parse(saved));
    } catch {
      // fallback
    }
    return DEFAULT_CAMPAIGN_PROGRESS;
  });

  // Warm up 3D GLTF & WebP Texture cache in the background while on the Main Menu
  useEffect(() => {
    AssetLoader.preloadAll((percent, label) => {
      setLoadProgress({ percent, label });
    }).catch(() => {
      // Fallbacks handled inside AssetLoader
    });
  }, []);

  // HUD Real-time State
  const [hudData, setHudData] = useState<HudPayload | null>(null);

  // Mission Results
  const [missionEndData, setMissionEndData] = useState<{
    victory: boolean;
    stats: {
      kills: number;
      headshots: number;
      time: number;
      shotsFired: number;
      accuracy: number;
      alarms: number;
    };
  } | null>(null);

  const handleUpdateSettings = (newSettings: GameSettings) => {
    const validated = sanitizeSettings(newSettings);
    setSettings(validated);
    try {
      localStorage.setItem('igi_game_settings', JSON.stringify(validated));
    } catch {
      // ignore
    }
    if (engineRef.current) {
      engineRef.current.updateSettings(validated);
    }
  };

  // Launch a selected mission after ensuring 3D assets are preloaded
  const startMission = async (missionId: MissionId = selectedMissionId) => {
    setSelectedMissionId(missionId);
    setMissionEndData(null);
    setIsTacticalMapOpen(false);
    setIsSettingsOpen(false);

    if (!AssetLoader.isPreloaded()) {
      setIsLoadingAssets(true);
      await AssetLoader.preloadAll((percent, label) => {
        setLoadProgress({ percent, label });
      });
      setIsLoadingAssets(false);
    }

    setGameState('playing');

    if (containerRef.current) {
      if (engineRef.current) {
        engineRef.current.destroy();
      }

      engineRef.current = new GameEngine(
        containerRef.current,
        {
          onHudUpdate: (data) => {
            setHudData(data);
          },
          onMissionEnd: (victory, stats) => {
            handleMissionCompleted(missionId, victory, stats);
          },
        },
        settings,
        missionId
      );
    }
  };

  const handleMissionCompleted = (
    missionId: MissionId,
    victory: boolean,
    stats: {
      kills: number;
      headshots: number;
      time: number;
      shotsFired: number;
      accuracy: number;
      alarms: number;
    }
  ) => {
    setGameState(victory ? 'victory' : 'failed');
    setMissionEndData({ victory, stats });

    if (victory) {
      let stars = 1;
      if (stats.alarms === 0) stars = 2;
      if (stats.alarms === 0 && (stats.accuracy >= 50 || stats.headshots >= 3)) stars = 3;

      setCampaignProgress((prev) => {
        const cur = prev[missionId];
        const nextProg = { ...prev };
        nextProg[missionId] = {
          unlocked: true,
          completed: true,
          stars: Math.max(cur?.stars || 0, stars),
          bestTime: cur?.bestTime ? Math.min(cur.bestTime, stats.time) : stats.time,
          highestAccuracy: cur?.highestAccuracy
            ? Math.max(cur.highestAccuracy, stats.accuracy)
            : stats.accuracy,
        };

        // Unlock next mission
        if (missionId === 'mission_01') {
          nextProg.mission_02 = { ...nextProg.mission_02, unlocked: true };
        } else if (missionId === 'mission_02') {
          nextProg.mission_03 = { ...nextProg.mission_03, unlocked: true };
        } else if (missionId === 'mission_03') {
          nextProg.mission_04 = { ...nextProg.mission_04, unlocked: true };
        }

        try {
          localStorage.setItem('igi_campaign_progress', JSON.stringify(nextProg));
        } catch {
          // ignore
        }
        return nextProg;
      });
    }
  };

  const handleNextMission = () => {
    if (selectedMissionId === 'mission_01') {
      startMission('mission_02');
    } else if (selectedMissionId === 'mission_02') {
      startMission('mission_03');
    } else if (selectedMissionId === 'mission_03') {
      startMission('mission_04');
    } else {
      setGameState('menu');
    }
  };

  const handleAbortToMenu = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setGameState('menu');
    setIsTacticalMapOpen(false);
    setIsSettingsOpen(false);
  };

  const safeExitPointerLock = () => {
    try {
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch {
      // Ignored
    }
  };

  const currentMissionDef =
    CAMPAIGN_MISSIONS.find((m) => m.id === selectedMissionId) || CAMPAIGN_MISSIONS[0];

  // Global Keyboard Shortcuts (Escape for Pause / Settings, Tab/M for Map)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' && gameState !== 'paused') return;

      if (e.code === 'Tab' || e.code === 'KeyM') {
        if (gameState === 'playing') {
          e.preventDefault();
          setIsTacticalMapOpen((prev) => {
            if (!prev) safeExitPointerLock();
            return !prev;
          });
        }
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (isTacticalMapOpen) {
          setIsTacticalMapOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else {
          setGameState((prev) => {
            if (prev === 'playing') {
              safeExitPointerLock();
              return 'paused';
            } else if (prev === 'paused') {
              return 'playing';
            }
            return prev;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isTacticalMapOpen, isSettingsOpen]);

  // Clean up engine on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D WebGL Render Canvas Container */}
      <div
        ref={containerRef}
        className={`absolute inset-0 w-full h-full cursor-crosshair z-0 ${
          gameState === 'menu' ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        }`}
      />

      {/* 1. Main Menu with Level Indexer & Dossiers */}
      {gameState === 'menu' && (
        <MainMenu
          campaignProgress={campaignProgress}
          selectedMissionId={selectedMissionId}
          onSelectMission={(id) => setSelectedMissionId(id)}
          onLaunchMission={(id) => startMission(id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* 1b. 3D Asset Preloading Progress Overlay */}
      {isLoadingAssets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 font-mono text-emerald-400">
          <div className="w-full max-w-md bg-black/90 border-2 border-emerald-600/80 rounded-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-900 pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span className="font-bold tracking-widest text-sm text-emerald-300">
                  SATELLITE UPLINK // STREAMING 3D ASSETS
                </span>
              </div>
              <Radio className="w-4 h-4 text-emerald-500 animate-spin" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-emerald-300">
                <span className="truncate pr-2">{loadProgress.label}</span>
                <span className="font-bold">{Math.round(loadProgress.percent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-emerald-950 rounded overflow-hidden border border-emerald-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-150"
                  style={{
                    width: `${Math.min(100, Math.round(loadProgress.percent))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-emerald-600">
                <span>GLTF 2.0 PBR PIPELINE</span>
                <span>17 3D MODELS + 11 PBR TEXTURES</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. In-Game Heads Up Display */}
      {(gameState === 'playing' || gameState === 'paused') && hudData && (
        <>
          <HUD
            health={hudData.health}
            armor={hudData.armor}
            stamina={hudData.stamina}
            currentWeapon={hudData.currentWeapon}
            weapons={hudData.weapons}
            stealthVisibility={hudData.stealthVisibility}
            stealthNoise={hudData.stealthNoise}
            compassHeading={hudData.compassHeading}
            isAiming={hudData.isAiming}
            isReloading={hudData.isReloading}
            hitMarker={hudData.hitMarker}
            isHeadshotHit={hudData.isHeadshotHit}
            damageDirection={hudData.damageDirection}
            baseAlarmActive={hudData.baseAlarmActive}
            objectives={hudData.objectives}
            interactionPrompt={hudData.interactionPrompt}
            leanOffset={hudData.leanOffset}
            isNightVision={hudData.isNightVision}
            isBinoculars={hudData.isBinoculars}
            taggedEnemies={hudData.enemies.filter((e) => e.isTagged && e.alertState !== 'dead')}
            settings={settings}
            grenades={hudData.grenades}
            c4Count={hudData.c4Count}
            c4Planted={hudData.c4Planted}
            powerCut={hudData.powerCut}
            fps={hudData.fps}
            onOpenTacticalMap={() => {
              safeExitPointerLock();
              setIsTacticalMapOpen(true);
            }}
            onOpenSettings={() => {
              safeExitPointerLock();
              setIsSettingsOpen(true);
            }}
            onToggleNightVision={() => engineRef.current?.toggleNightVision()}
            onToggleBinoculars={() => engineRef.current?.toggleBinoculars()}
          />

          {/* Mobile & Hybrid Touch Controls Overlay */}
          {gameState === 'playing' && (
            <TouchControls
              inputSystem={engineRef.current?.getContext().systems.input ?? null}
              isAiming={hudData.isAiming}
              isCrouching={engineRef.current?.getContext().player.isCrouching ?? false}
              isNightVision={hudData.isNightVision}
              isBinoculars={hudData.isBinoculars}
              c4Planted={hudData.c4Planted}
              onOpenMap={() => {
                safeExitPointerLock();
                setIsTacticalMapOpen(true);
              }}
              onPause={() => {
                safeExitPointerLock();
                setGameState('paused');
              }}
            />
          )}

          {/* Night Vision Goggles Viewport Filter */}
          {hudData.isNightVision && <NightVisionOverlay battery={hudData.nvgBattery} />}

          {/* Tactical Reconnaissance Binoculars Overlay */}
          {hudData.isBinoculars && (
            <BinocularsOverlay
              targetDistance={hudData.targetDistance}
              compassHeading={hudData.compassHeading}
              targetedEnemy={hudData.targetedEnemy}
              onTagEnemy={() => engineRef.current?.tagCurrentTarget()}
            />
          )}

          {/* Sniper Optical Scope Overlay */}
          {!hudData.isBinoculars && hudData.isAiming && hudData.currentWeapon.id === 'sniper' && (
            <SniperScopeOverlay />
          )}

          {/* Tactical Satellite Reconnaissance Map PDA */}
          <TacticalMapModal
            isOpen={isTacticalMapOpen}
            onClose={() => setIsTacticalMapOpen(false)}
            playerPos={engineRef.current ? engineRef.current.getPlayerPosition() : [0, 0, 0]}
            heading={hudData.compassHeading}
            enemies={hudData.enemies}
            objectives={hudData.objectives}
            baseAlarmActive={hudData.baseAlarmActive}
          />
        </>
      )}

      {/* 3. In-Game Pause Menu */}
      {gameState === 'paused' && hudData && (
        <PauseMenu
          isOpen={true}
          missionTitle={currentMissionDef.title}
          missionCodeName={currentMissionDef.codeName}
          objectives={hudData.objectives}
          onResume={() => setGameState('playing')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onRestart={() => startMission(selectedMissionId)}
          onAbortToMenu={handleAbortToMenu}
        />
      )}

      {/* 4. Settings Configuration Modal (Accessible from Main Menu and In-Game Pause) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* 5. Mission End Debriefing Modal */}
      {(gameState === 'victory' || gameState === 'failed') && missionEndData && (
        <MissionEndModal
          victory={missionEndData.victory}
          missionTitle={currentMissionDef.title}
          stats={missionEndData.stats}
          hasNextMission={selectedMissionId !== 'mission_04'}
          onRestart={() => startMission(selectedMissionId)}
          onNextMission={handleNextMission}
          onMainMenu={handleAbortToMenu}
        />
      )}
    </div>
  );
}

export default App;
