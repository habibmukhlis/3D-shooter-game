# Pre-Deployment Mission Briefing Dossier & WebAudio Tactical Sound Engine

An interactive pre-mission intelligence briefing system and procedural WebAudio API sound engine that bridges campaign selection and 3D tactical infiltration with mission-specific lore, objectives, strategic hints, weapon loadouts, environmental audio atmospheres, surface-aware footsteps, and real-time volume controls.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and UX decisions were confirmed during Phase 1 and govern this implementation:

- **Confirmed Briefing Flow**: The `MissionBriefingModal` will appear before **every** mission launch (from the Main Menu) and **every** next-mission transition (from the Mission End debriefing screen), transitioning `gameState` through `'briefing'` before starting the 3D engine in `'playing'` mode.
- **Confirmed Briefing Dossier Scope**:
  - Mission-specific operational lore (`dossierSummary`), primary and secondary objectives with target coordinates, and strategic field hints (`briefingNotes`).
  - Tactical reconnaissance telemetry card displaying threat level, time of day, weather conditions, and insertion coordinates.
  - Interactive starting weapon and equipment loadout overview (inspecting the Combat Knife, Silenced Pistol, AK-74M, Dragunov Sniper, Night Vision, and Binoculars with ballistics specs).
  - Simulated teletype briefing audio cue with an integrated quick-mute toggle and an abort-to-menu action.
- **Confirmed WebAudio Sound Engine & Settings Enhancements**:
  - **Environment-Specific Ambient Soundscapes**: Tailored procedural ambient loops for Night Depot (cold low-pass compound wind & distant transformer hum), Daylight Radar (arid high-frequency desert wind & radar dish sweep pulse), and Mountain Dawn (howling alpine ridge gusts).
  - **Surface-Aware & Stance-Aware Footsteps**: Distinct procedural footstep synthesis for walking vs. sprinting across concrete, metal grating/watchtowers, and outdoor terrain, while remaining silent when crouched.
  - **SettingsModal Audio Controls**: Dedicated Master Mute toggle alongside Master, Combat SFX, and Ambient/Siren volume sliders, featuring a live audio preview chime when adjusting levels.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces the immediate jump from menu selection into 3D rendering with a deliberate, atmospheric pre-mission intelligence briefing screen (`MissionBriefingModal`), while upgrading the procedural WebAudio API synthesizer (`SoundManager`) so every environment, movement stance, weapon shot, alarm siren, and volume adjustment delivers responsive acoustic feedback.
- **Target Audience / Persona**: Tactical stealth FPS players who rely on pre-mission intelligence (understanding guard sightlines, alarm terminal locations, and weather visibility) and directional/environmental audio cues during infiltration.
- **Key Value**: Gives each of the three campaign missions a distinct narrative and acoustic identity while ensuring players have complete, immediate control over Master, SFX, and Ambient audio levels.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Mission Launch & Pre-Deployment Briefing (`menu` → `briefing` → `playing`)**:
   - When the player selects a mission in the Main Menu and clicks **Deploy**, or clicks **Next Mission** after completing an operation, the app enters the `'briefing'` state and presents the `MissionBriefingModal`.
   - A subtle teletype data-stream sound plays as the mission dossier populates.
   - The player reviews the **Situation Report (Lore)**, **Primary & Secondary Objectives**, **Strategic Field Hints**, and **Tactical Recon Telemetry** (location, time of day, weather, threat level).
   - The player can click through the **Interactive Starting Loadout** tabs to inspect weapon damage, suppression status, magnification, and tactical gear before deployment.
   - Clicking **Start Mission** initializes the 3D WebGL engine and begins the mission-specific ambient soundscape; clicking **Return to Command** aborts back to the Main Menu.

2. **In-Game Procedural Audio Feedback**:
   - Upon deployment, the WebAudio engine starts the mission's environmental ambient loop (Night Depot, Daylight Radar, or Mountain Dawn).
   - Moving across the compound triggers stance-aware and surface-aware footsteps (crisp metallic resonance on watchtowers/catwalks, muted crunch on ground terrain, heavier cadence when sprinting, silent when crouching).
   - Firing weapons (silenced pistol, assault rifle, sniper rifle, combat knife) and triggering or disabling base alarms route through dedicated SFX and Ambient/Siren gain buses.

3. **Audio Configuration & Live Preview (`SettingsModal`)**:
   - Opening the Settings Modal (from the Main Menu or In-Game Pause Menu) and selecting the **Audio** tab presents a **Master Audio Mute** toggle alongside **Master Volume**, **Ballistics & Combat SFX Volume**, and **Environment & Siren Ambience Volume** sliders.
   - Adjusting any slider or toggling mute immediately updates the WebAudio `GainNode` buses, persists to `localStorage`, and triggers a non-intrusive acoustic test pulse so the user can hear the exact volume level in real time.

### Visual Identity & Theme

- **Aesthetic Direction**: Cold War classified satellite command terminal—utilitarian, high-contrast, and legible.
- **Color Palette & Surface Hierarchy (60-30-10 Discipline)**:
  - **60% Dominant Canvas**: Deep obsidian slate (`#090d16` / `bg-slate-950/95`) with subtle backdrop blur over the viewport.
  - **30% Structural Surfaces**: Subdued tactical panels (`bg-slate-900/70`) separated by `1px` hairline borders (`border-slate-800`) and generous internal padding (`24px` outer container padding, `16px` inner grid gaps).
  - **10% Accent Budget**: Radar emerald (`#10b981`) for primary interactive actions and confirmed states, tactical amber (`#f59e0b`) for strategic hints and elevated threat indicators, and crimson (`#ef4444`) strictly for high-threat warnings or muted audio states.
- **Typography & Hierarchy**:
  - **Display & Section Headings**: Geometric sans (`Plus Jakarta Sans`), clean title-case hierarchy, `text-wrap: balance`.
  - **Telemetry & Numerical Readouts**: Tabular monospace (`JetBrains Mono` / `tabular-nums`) for mission timestamps, coordinates, weapon ballistic specs, and volume percentages.
  - **Zero-Pill & Anti-Slop Discipline**: Metadata (coordinates, weather, time of day, weapon slots) is rendered as clean unboxed text with `·` or `/` typographic separators, avoiding decorative pulsing dots or code-comment (`//`) headers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dedicated `'briefing'` GameState Before Engine Instantiation**:
  - *Chosen Approach*: Route mission launches through `gameState = 'briefing'` first, and instantiate `new GameEngine(...)` only when the user clicks **Start Mission** inside `MissionBriefingModal`.
  - *Why*: Prevents enemy patrols, mission timers, and pointer-lock requests from running in the background while the player is reading objectives and strategic hints, and guarantees a fresh user gesture to unlock the browser `AudioContext`.
  - *Alternatives Considered*: Rendering the briefing modal on top of an already-running `GameEngine` instance, which risks background guard detection and premature pointer-lock conflicts.
- **Decision 2: Procedural WebAudio Synthesis with Multi-Bus Gain Routing**:
  - *Chosen Approach*: Use native WebAudio API oscillators, biquad filters, and shaped noise buffers routed through three independent gain stages (`masterGain`, `sfxGain`, `ambientGain`).
  - *Why*: Zero external audio file dependencies or network loading latency, deterministic synthesis for every weapon and surface type, and instant real-time volume/mute response when dragging sliders in `SettingsModal`.
  - *Alternatives Considered*: Fetching external MP3/WAV assets, which can fail or stall in sandboxed environments.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             App State Controller                            │
│        (gameState: 'menu' | 'briefing' | 'playing' | 'paused' | ...)        │
└──────┬──────────────────────────────┬────────────────────────────────┬──────┘
       │                              │                                │
       ▼                              ▼                                ▼
┌──────────────────────┐   ┌──────────────────────────┐   ┌───────────────────┐
│      MainMenu        │   │   MissionBriefingModal   │   │   SettingsModal   │
│ - Select Mission     │──▶│ - Mission Lore & Intel   │   │ - Mute Toggle     │
│ - Open Briefing      │   │ - Primary/Secondary Objs │   │ - Master Slider   │
└──────────────────────┘   │ - Strategic Field Hints  │   │ - SFX Slider      │
                           │ - Interactive Loadout    │   │ - Ambient Slider  │
                           │ - Teletype SFX & Mute    │   │ - Live Test Chime │
                           └────────────┬─────────────┘   └─────────┬─────────┘
                                        │                           │
                          [Start Mission]                           │
                                        ▼                           ▼
┌──────────────────────────────────────────────────────┐  ┌───────────────────┐
│                    3D GameEngine                     │  │   SoundManager    │
│ - Passes Mission Environment Type on Init            │─▶│  (WebAudio API)   │
│ - Detects Player Surface (Ground vs. Metal/Tower)    │  │ - Master/SFX/Amb  │
│ - Triggers Weapon, Footstep, Alarm & Objective Audio │  │   Gain Buses      │
└──────────────────────────────────────────────────────┘  └───────────────────┘
```

### Data Model & State

- **`GameSettings` Extension**:
  - Includes `isMuted: boolean` alongside `masterVolume` (0–100), `sfxVolume` (0–100), and `ambientVolume` (0–100), persisted in `localStorage` (`igi_game_settings`) and synchronized with `SoundManager` on initialization and every setting change.
- **`MissionBriefingModal` Props & State**:
  - Accepts `mission: MissionDefinition`, `onStartMission: () => void`, `onCancel: () => void`, `isMuted: boolean`, and `onToggleMute: () => void`.
  - Local interactive state `selectedWeaponIdx` (0–5) for inspecting the starting weapons and tactical optics loadout, and a simulated progressive teletype reveal state for the intelligence report.
- **`SoundManager` Acoustic Profiles**:
  - `startEnvironmentAmbience(env: 'night_depot' | 'daylight_radar' | 'mountain_dawn')`: Configures filtered noise generators and subtle LFO modulation matching the active mission environment.
  - `playFootstep(isSprinting: boolean, isCrouching: boolean, surface: 'ground' | 'metal' | 'concrete')`: Adjusts filter resonance and transient pitch based on player elevation/surface collider and movement stance.
  - `playTeletypeTick()` & `playVolumePreview(channel: 'master' | 'sfx' | 'ambient')`: Provides immediate acoustic feedback during briefing reveal and volume slider adjustments.

### Interactive Component & State Mapping

- **Main Menu → Briefing Transition**: Clicking "Deploy" on an unlocked mission card sets `selectedMissionId` and transitions `gameState` to `'briefing'`.
- **Mission End → Next Mission Briefing**: Clicking "Next Operation" on the victory debrief modal advances `selectedMissionId` to the next campaign mission and transitions `gameState` to `'briefing'`.
- **Briefing Modal Interactions**:
  - Clicking any loadout item tab updates the inspected weapon specification card and plays a crisp UI click.
  - Clicking the Audio Mute button toggles `settings.isMuted` and updates `SoundManager` immediately.
  - Clicking "Start Mission" transitions `gameState` to `'playing'`, instantiates `GameEngine`, and starts the mission's ambient audio loop.
  - Clicking "Return to Menu" or pressing `Escape` in `'briefing'` mode returns cleanly to `gameState = 'menu'`.
- **Settings Modal Audio Sync**:
  - Toggling the Mute switch or dragging Master, SFX, or Ambient sliders updates `settings`, syncs `soundManager.setVolumes(...)` and `soundManager.setMuted(...)`, and triggers a throttled preview tone on the corresponding bus.
