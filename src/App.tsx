import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import {
  CAMPAIGN_MISSIONS,
  CampaignProgressRecord,
  DEFAULT_CAMPAIGN_PROGRESS,
  DEFAULT_SETTINGS,
  EnemyData,
  GameSettings,
  GameState,
  MissionId,
  MissionObjective,
  WeaponData,
} from './types/game';
import { HUD } from './components/HUD';
import { SniperScopeOverlay } from './components/SniperScopeOverlay';
import { TacticalMapModal } from './components/TacticalMapModal';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { MissionEndModal } from './components/MissionEndModal';
import { SettingsModal } from './components/SettingsModal';
import { NightVisionOverlay } from './components/NightVisionOverlay';
import { BinocularsOverlay } from './components/BinocularsOverlay';
import { MainMenu } from './components/MainMenu';
import { PauseMenu } from './components/PauseMenu';

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Game States
  const [gameState, setGameState] = useState<GameState>('menu');
  const [selectedMissionId, setSelectedMissionId] = useState<MissionId>('mission_01');
  const [isTacticalMapOpen, setIsTacticalMapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings State with LocalStorage Persistence
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('igi_game_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  });

  // Campaign Progress Persistence
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgressRecord>(() => {
    try {
      const saved = localStorage.getItem('igi_campaign_progress');
      if (saved) return { ...DEFAULT_CAMPAIGN_PROGRESS, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_CAMPAIGN_PROGRESS;
  });

  // HUD Real-time State
  const [hudData, setHudData] = useState<{
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
    damageDirection: number | null;
    baseAlarmActive: boolean;
    objectives: MissionObjective[];
    interactionPrompt: string | null;
    enemies: EnemyData[];
    leanOffset: number;
    isNightVision: boolean;
    isBinoculars: boolean;
    nvgBattery: number;
    targetDistance: number | null;
    targetedEnemy: EnemyData | null;
  } | null>(null);

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
    setSettings(newSettings);
    try {
      localStorage.setItem('igi_game_settings', JSON.stringify(newSettings));
    } catch {
      // ignore
    }
    if (engineRef.current) {
      engineRef.current.updateSettings(newSettings);
    }
  };

  // Launch a selected mission
  const startMission = (missionId: MissionId = selectedMissionId) => {
    setSelectedMissionId(missionId);
    setGameState('playing');
    setMissionEndData(null);
    setIsTacticalMapOpen(false);
    setIsSettingsOpen(false);

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

  const currentMissionDef =
    CAMPAIGN_MISSIONS.find((m) => m.id === selectedMissionId) || CAMPAIGN_MISSIONS[0];

  const safeExitPointerLock = () => {
    try {
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch {
      // Ignored
    }
  };

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
            damageDirection={hudData.damageDirection}
            baseAlarmActive={hudData.baseAlarmActive}
            objectives={hudData.objectives}
            interactionPrompt={hudData.interactionPrompt}
            leanOffset={hudData.leanOffset}
            isNightVision={hudData.isNightVision}
            isBinoculars={hudData.isBinoculars}
            taggedEnemies={hudData.enemies.filter((e) => e.isTagged && e.alertState !== 'dead')}
            settings={settings}
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
          hasNextMission={selectedMissionId !== 'mission_03'}
          onRestart={() => startMission(selectedMissionId)}
          onNextMission={handleNextMission}
          onMainMenu={handleAbortToMenu}
        />
      )}
    </div>
  );
}

export default App;
