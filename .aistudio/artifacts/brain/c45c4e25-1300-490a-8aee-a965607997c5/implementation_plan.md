# Project I.G.I. Remake: Multi-Mission Campaign, Physics Overhaul & Settings System

An authentic Cold War tactical stealth simulation featuring a 3-mission campaign roster, full main menu with level indexer and star ratings, robust collision physics preventing clipping and shooting through obstacles, and comprehensive graphics, audio, and control settings accessible from both the main menu and pause screen.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following directions have been confirmed and synthesized into this blueprint:

- **Confirmed Campaign Roster**: 3 distinctive tactical operations:
  - **Mission 01: Night Infiltration (Supply Depot)** — Moonlit compound, spotlight sweeps, alarm sabotage, intel recovery, and watchtower snipers.
  - **Mission 02: Daylight Radar (Desert Outpost)** — Bright sunlit communications facility, parabolic radar arrays, long-range guard sightlines, power generator sabotage, and data uplink hijack.
  - **Mission 03: Mountain Dawn (Bunker Facility)** — Dawn mist, terraced mountain stronghold, heavy sentries, missile silo console override, and rooftop helipad extraction.
- **Confirmed Menu & Progression**: Full tactical Main Menu with an interactive Level Indexer, classified dossiers, mission unlock progression, and 3-star tactical performance rating (stealth, accuracy, time).
- **Confirmed Settings Integration**: Unified Settings configuration panel accessible directly from the Main Menu as well as via the in-game Pause screen (`Esc`).
- **Confirmed Physics & Ballistic Upgrades**: Bounding box capsule-sweeping collision prevents walking through buildings/crates, and dual-raycast muzzle clearance ensures neither players nor enemies can shoot through walls or solid cover.

---

## 1. Overview & Core Concept

- **What It Delivers**: A comprehensive expansion of Project I.G.I. Remake from a single test sandbox into a full-featured tactical stealth game. Players navigate a Cold War command terminal Main Menu, inspect classified mission dossiers, adjust graphics and input sensitivities, and undertake three distinct operational missions with realistic physics, lighting, and AI behavior.
- **Target Experience**: Methodical, high-stakes tactical infiltration inspired by classic *Project I.G.I.: I'm Going In*. Sneaking past patrol routes, shooting surveillance cameras, sabotaging alarm consoles, neutralizing tower snipers with scoped rifles, and managing recoil behind realistic physical cover.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Title & Operations Hub (Main Menu)**:
   - High-contrast tactical command terminal with mission dossier selection.
   - **Level Indexer**: Carousel or grid of 3 missions displaying operational title, time of day (Night / Daylight / Dawn), difficulty, completed star ratings, high score, and unlock status.
   - **Mission Dossier**: Intel summary, satellite recon snapshot, tactical objectives preview, and primary gear loadout before launching.
   - **Operations Controls**: "Deploy to Mission", "Operational Settings", and "Controls Guide".

2. **In-Game Experience & Physics Simulation**:
   - Immersive first-person perspective with authentic weapon models (Combat Knife, Silenced Glock 17-SD, AK-74M, Dragunov SVD sniper with PSO-1 reticle).
   - Strict physical barriers: walls, security booths, sandbag bunkers, shipping containers, and perimeter fences block movement and stop projectiles.
   - Muzzle-to-Target Ballistics: Weapons trace bullet trajectories from physical barrel origin to crosshair hit point. If a crate, wall, or corner intervenes, bullet impacts trigger concrete dust or wood sparks with ricochet audio without penetrating solid geometry.
   - AI Line of Sight: Enemy guards cast unobstructed visual rays; if the player is behind a crate or wall, detection stays at 0% and enemy fire stops immediately upon losing line of sight.

3. **In-Game Pause & Configuration Screen (`Esc`)**:
   - Freezes simulation and pointer lock.
   - Displays current mission objectives checklist, operational timer, and quick options: "Resume Operation", "Mission Settings", "Restart Operation", and "Abort to Command Menu".

4. **Settings Configuration Panel**:
   - **Video & Graphics**: Render Quality / Pixel Ratio (0.75x Performance, 1.0x Native, 1.25x Ultra), Shadow Maps (Off / Medium / High), Atmospheric Fog Density (Low / High), Field of View (FOV: 65° to 90°).
   - **Audio & Comms**: Master Volume slider, SFX Volume slider, Ambient Siren/Alarm Volume, Audio Mute toggle.
   - **Controls & Input**: Mouse Look Sensitivity (0.2x to 3.0x), Invert Y-Axis toggle, Weapon Bobbing toggle, Reticle Style (Dot, Crosshair, Classic I.G.I. Circle).
   - Saved automatically to browser `localStorage` and shared seamlessly between Main Menu and gameplay.

### Visual Identity & Theme

- **Palette**: Cold War tactical HUD theme. Dominant deep obsidian canvas (`#090d16` / `#0a0f1d`), crisp titanium text (`#f1f5f9`), tactical amber/gold (`#f59e0b`) and radar emerald (`#10b981`) accents, alert crimson (`#ef4444`).
- **Daylight vs. Night Moods**:
  - *Mission 1 (Night)*: Deep navy-grey fog, moonlit directional lighting, warm incandescent spotlight cones.
  - *Mission 2 (Daylight)*: Crisp desert sunshine with warm directional sun, sharp building shadows, high-visibility guard sightlines.
  - *Mission 3 (Dawn)*: Golden-hour rim lighting with cool blue ground mist and bunker spotlights.
- **Typography**: Neo-grotesque sans (`Plus Jakarta Sans`) for interface controls paired with tabular monospace numerals (`JetBrains Mono` / `tabular-nums`) for coordinates, compass degrees, ammunition counts, and stopwatches.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Campaign Generation in MapBuilder**:
  - *Approach*: Modular environment generator supporting environment types (`night_depot`, `daylight_radar`, `mountain_bunker`) with custom building footprints, radar dishes, satellite terminals, generator units, watchtowers, and bunker tunnels.
  - *Why*: Allows distinct, authentic mission geometries and lighting conditions without heavyweight asset downloads, running instantly in Vite/WebGL.
- **Decision 2: Player Bounding Capsule & Physics Sweeping**:
  - *Approach*: Segmented bounding cylinder with multiple test heights (foot, torso, head) sweeping against all collidable scene bounding boxes (`THREE.Box3`).
  - *Why*: Completely eliminates clipping through walls or diagonal corner leaks, while allowing smooth stepping over small obstacles and stair ramps.
- **Decision 3: Weapon Barrel Raycasting for Real Line of Fire**:
  - *Approach*: Bullet traces originate from the true 3D muzzle location in world space directed toward the reticle focal point, checking for static environment hits before registering enemy damage.
  - *Why*: Resolves the player issue of "shooting through objects"—if the player is hugging a wall or crouched behind a crate with the gun barrel blocked, bullets strike the obstacle directly in front of them.
- **Decision 4: Unified Settings Store in `localStorage`**:
  - *Approach*: Typed settings store with immediate callback dispatching to `GameEngine` (e.g. updating camera FOV, mouse sensitivity multiplier, shadow map resolution, and audio gain nodes).
  - *Why*: Settings changes take effect immediately without requiring a game restart.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          App Container State                           │
│  (Mode: 'main_menu' | 'playing' | 'paused' | 'debrief', ActiveMission)  │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│    Main Menu     │    │   In-Game HUD    │    │ Settings Modal   │
│  - Level Indexer │    │  - Compass Tape  │    │  - Video Quality │
│  - Star Ratings  │    │  - Health/Armor  │    │  - Mouse Sens    │
│  - Dossier Modal │    │  - Ammo & Weapon │    │  - Master Audio  │
│  - Launch Button │    │  - Satellite Map │    │  - FOV / Bobbing │
└──────────────────┘    └─────────┬────────┘    └──────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3D WebGL Game Engine                            │
│  ┌───────────────────────┐ ┌───────────────────┐ ┌──────────────────┐  │
│  │   Camera & Controls   │ │ Dynamic Lighting  │ │  Sound Synthesizer│ │
│  │ - Pointer Lock / Sens │ │ - Sun / Spotlights│ │ - Gunshot & Siren│ │
│  │ - FOV & Recoil System │ │ - Directional Fog │ │ - Footstep/Reload│ │
│  └───────────┬───────────┘ └─────────┬─────────┘ └──────────────────┘  │
│              │                       │                                 │
│              ▼                       ▼                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Physics & Ballistics Engine                   │  │
│  │ - Multi-point Player Collision Sweeper (No walking through walls)│  │
│  │ - Muzzle Raycast Clearance (No shooting through cover)           │  │
│  │ - Dynamic Enemy AI Perception Raycaster (No vision through walls)│  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  │                                     │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Mission Builder (MapBuilder 3-Level Setup)          │  │
│  │ - Mission 01: Cold War Depot (Night, Alarms, Perimeter Towers)   │  │
│  │ - Mission 02: Radar Station (Daylight, Generator, Dish Hack)     │  │
│  │ - Mission 03: Mountain Silo (Dawn, Terraced Bunkers, Extraction) │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Campaign Missions Specification

| Mission ID | Title & Setting | Objectives | Atmosphere & Time |
| :--- | :--- | :--- | :--- |
| **`mission_01`** | **Operation Eagle Eye**<br>Supply Depot & Logistics | 1. Disable Main Security Alarm<br>2. Eliminate 2 Watchtower Snipers<br>3. Steal Encrypted Intel Briefcase<br>4. Extract via South Helipad | Night, Blue Fog (`#0a1020`), Spotlights, Incandescent lamps |
| **`mission_02`** | **Operation Sunburst**<br>Desert Radar Telemetry Base | 1. Sabotage Power Generator Grid<br>2. Hack Satellite Radar Console<br>3. Eliminate Communications Officer<br>4. Exfiltrate via Desert Gate | High Noon Sun (`#fef08a`), Warm Dust Fog, Long Sightlines |
| **`mission_03`** | **Operation Iron Dawn**<br>Mountain Silo Stronghold | 1. Breach Perimeter Bunker<br>2. Deactivate Missile Silo Terminal<br>3. Neutralize Base Commander<br>4. Board Extraction Chopper on Roof | Dawn Rimlight (`#fdba74`), Mountain Ridge Mist, Heavy Armor Patrols |

### Progression & Settings Data Structure

```typescript
export interface GameSettings {
  mouseSensitivity: number; // 0.2 to 3.0 (default 1.0)
  invertY: boolean;         // default false
  fov: number;              // 65 to 90 degrees (default 75)
  weaponBobbing: boolean;   // default true
  crosshairStyle: 'dot' | 'cross' | 'classic';
  renderScale: number;      // 0.75, 1.0, 1.25
  shadows: 'off' | 'medium' | 'high';
  fogQuality: 'low' | 'high';
  masterVolume: number;     // 0 to 1 (default 0.8)
  sfxVolume: number;        // 0 to 1 (default 0.9)
  ambientVolume: number;    // 0 to 1 (default 0.7)
  isMuted: boolean;
}

export interface MissionProgress {
  missionId: string;
  unlocked: boolean;
  completed: boolean;
  stars: number; // 0 to 3
  bestTime: number; // in seconds
  highestScore: number;
}
```

---

## 5. Execution Steps (Post-Approval)

1. **Mission Configuration & Types (`src/types/game.ts`)**:
   - Define multi-mission campaign contracts, settings schema, level indexer models, and star rating criteria.
2. **Audio & Sound Settings Extension (`src/audio/SoundManager.ts`)**:
   - Add master/sfx/ambient gain control nodes and daylight wind/mountain ambient loops.
3. **Multi-Environment Map Builder (`src/game/MapBuilder.ts`)**:
   - Implement environmental archetypes: `night_depot`, `daylight_radar` (parabolic dishes, transformers, sun sky), and `mountain_bunker` (silo covers, concrete bunkers, catwalks).
   - Tag physical colliders with bounding boxes and surface material types (concrete, metal, wood).
4. **Physics & Ballistics Hardening (`src/game/GameEngine.ts`)**:
   - Multi-point bounding cylinder collision preventing clipping through any wall or crate.
   - Dual-raycast muzzle-clearance ballistic system stopping shots fired into walls or through cover.
   - Guard line-of-sight raycasts verified against all level colliders.
   - Mission loader API to reset and initialize selected mission environments, objectives, and guard schedules.
5. **Main Menu & Level Indexer Component (`src/components/MainMenu.tsx`)**:
   - High-fidelity Cold War terminal UI with interactive mission carousel/grid, star ratings, tactical dossiers, and launch triggers.
6. **Settings Panel Component (`src/components/SettingsModal.tsx`)**:
   - Tabbed or categorized configuration controls (Video, Audio, Controls) with live preview and reset to defaults.
7. **Pause Menu (`src/components/PauseMenu.tsx`) & In-Game UI Integration (`src/App.tsx`)**:
   - Seamless switching between Main Menu, Active Mission, Pause Menu with Settings, and Mission Debriefing.
8. **Build Verification & Compilation**:
   - Ensure clean build, no type errors, and verified 60 FPS rendering across all 3 missions.
