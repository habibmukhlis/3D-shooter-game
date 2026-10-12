# Project I.G.I. Remake - System Architecture & Technical Audit

**Project:** `Fps_Igi_game` (Unreal Engine 5.6)  
**Repository:** `Project_ISR`  
**Target Architecture:** First-Person Tactical Stealth Shooter  
**Lead Systems Architect Audit Date:** September 2026  

---

## 1. Executive Summary

### 1.1 Template Origin & Current State
The project originated from the Unreal Engine **Blank Blueprint Template** (`TP_BlankBP`) and has been assembled into a first-person shooter framework utilizing imported marketplace asset packs and custom Blueprints. 

- **Implementation Level:** ~40% Prototype State.
- **Underlying Codebase:** **100% Pure Blueprint** (`.uasset`). There is currently no active C++ module in `/Source/`. All character logic, gun mechanics, HUD updates, and AI perception currently execute via Blueprint virtual machines.
- **Playable Map:** `Content/_Main_Map.umap` contains the main Project I.G.I. military base level layout, terrain, buildings, vehicles, and patrol areas.
- **Hardware Profile:** Custom-tuned for Intel Integrated Graphics (Screen Space GI/Reflections, Cascaded Shadow Maps, D3D12 SM5).

---

## 2. Directory Structure & Key Subsystems

```
IGI_Project/
├── Config/                         # Engine, input, and hardware scalability configuration
│   ├── DefaultEditor.ini           # Editor preview scene and post-process profiles
│   ├── DefaultEngine.ini           # RHI, renderer (SSGI/SSR), map redirects, and system settings
│   ├── DefaultGame.ini             # Project identification metadata
│   ├── DefaultInput.ini            # Legacy action/axis keybindings (WASD, Fire, Sprint, Crouch)
│   └── DefaultScalability.ini      # Custom scalability overrides for low/mid hardware tiers
├── Content/                        # Compiled binary game assets (.uasset, .umap)
│   ├── _Main_Map.umap              # Primary playable military base mission level
│   ├── AmmoMag_BP/                 # Physical ammunition pickups and magazine drop actors
│   │   ├── Ammo_Mag.uasset         # Dropped magazine mesh actor
│   │   └── Ammo_Pickup.uasset      # World ammo box pickup blueprint
│   ├── FPS_Character/              # Player character, arms rig, and weapon handling
│   │   ├── BP_FPS/
│   │   │   ├── BP_FPS_Character    # Monolithic player character blueprint
│   │   │   └── My_GameMode         # Active GameModeBase defining default pawn
│   │   ├── FPS_Anims/              # Player camera animations and blends
│   │   ├── FPS_Gun/                # AK-74M skeletal mesh, textures, and reload montages
│   │   ├── HeadBob_CS/             # Camera shake blueprints (Fire, Idle, Jump, Sprint, Walk)
│   │   └── Rifle_Sound/            # Gunshot, empty click, and reload audio assets
│   ├── My_Ai_Bots/                 # Enemy combatants and artificial intelligence
│   │   ├── BB_Bot.uasset           # Blackboard data containing TargetActor key
│   │   ├── BT_Bot.uasset           # Behavior Tree for rifle combatants
│   │   ├── BP_Bot.uasset           # Standard enemy rifleman pawn
│   │   ├── BTTask_Patroling.uasset # [STUB] Patrol task blueprint (unimplemented)
│   │   ├── MyBot_Controller.uasset # AIController with UAIPerceptionComponent (Sight)
│   │   ├── Shooting_Service.uasset # BTService ticking aim and line-trace gunfire
│   │   ├── Anims/                  # Mixamo soldier animations and blend spaces
│   │   ├── Bot_Voices/             # Audio clips for detection, hit, and death
│   │   └── Sniper_Bot/             # Specialized sniper variant
│   │       ├── BP_SniperBot.uasset # Elevated sniper pawn
│   │       ├── SniperBot_Controller# Sniper AI controller
│   │       ├── SniperBT_Bot.uasset # Sniper behavior tree
│   │       └── Sniper_Shooting_Service # Sniper raycast shooting service
│   ├── Widgets_UI/                 # Unreal Motion Graphics (UMG) heads-up display
│   │   ├── W_Main.uasset           # Main HUD (health bar, ammo counter, crosshair)
│   │   ├── W_BloodEffect.uasset    # Full-screen directional damage overlay
│   │   └── CrossHair/              # Reticle textures and widget
│   ├── UltraDynamicSky/            # Dynamic time-of-day, sky sphere, and weather
│   ├── MilitaryWeapSilver/         # Weapon models, firing VFX, muzzle flashes, audio
│   ├── Environment_Assets/         # Modular military structures (guard towers, warehouses, fences)
│   └── Realistic_Starter_VFX_Pack/ # Blood splat cones, impact sparks, smoke particles
├── Launch_IGI_Unreal_Optimized.bat # High-stability engine launcher script
├── Fps_Igi_game.uproject           # Project descriptor file
├── .gitattributes                  # Git LFS tracking configuration
└── .gitignore                      # Engine build and cache ignore rules
```

---

## 3. Core Systems Reverse Engineering

### 3.1 GameMode, PlayerController, and Character

| Subsystem | Asset Path | Native Base Class | Implementation Details |
| :--- | :--- | :--- | :--- |
| **Game Mode** | `/Game/FPS_Character/BP_FPS/My_GameMode` | `AGameModeBase` | Spawns `BP_FPS_Character` at PlayerStart; triggers background ambient music `/Game/FPS_Character/Game_Sound/game_music_`. |
| **Player Controller** | *Engine Default* | `APlayerController` | No custom player controller asset exists. Uses engine default controller; input processing occurs inside the Character pawn. |
| **Player Character** | `/Game/FPS_Character/BP_FPS/BP_FPS_Character` | `ACharacter` | Contains First-Person Mesh (`arms`), CameraComponent, SpringArm, AudioComponents, and movement logic. |

### 3.2 Movement Mechanics
- **Walking / Running:** Driven by `CharacterMovementComponent`. Max walk speed defaults to 600 units/sec.
- **Sprinting:** Bound to `LeftShift`. Dynamically modifies `MaxWalkSpeed` and triggers `ClientStartCameraShake` with `Sprint_C`.
- **Crouching:** Bound to `LeftControl`. Leverages `Crouch()` / `UnCrouch()` on the character movement component.
- **Jumping:** Bound to `SpaceBar`. Uses standard `ACharacter::Jump()`.
- **Camera Sway & Head Bob:** 5 separate `CameraShakeBase` classes (`Idle`, `Walk`, `Sprint`, `Jump`, `Fire`) interpolated based on character velocity.

### 3.3 Combat, Weapons & Health
- **Architecture:** Monolithic Blueprint. Weapon data is not separated into modular Actor components or Data Assets.
- **Weapon Equipped:** AK-74M assault rifle.
- **Shooting System:**
  - Raycast: `LineTraceSingle` executed from camera center towards world crosshair target.
  - Projectile Visuals: Spawns particle tracer `Bullet_tracer` and ejects `Bullet_Shell` mesh at weapon socket.
  - Impact Feedback: Spawns `P_Impact_Metal_Medium_01` or `P_Impact_Stone_Large_01` depending on hit surface; spawns `P_Blood_Splat_Cone` when striking an enemy pawn.
  - Damage Delivery: Invokes `UGameplayStatics::ApplyPointDamage` targeting `HitActor`.
- **Ammunition & Reloading:**
  - Variables: `CurrentAmmo` (integer, max 30), `MaxAmmo` (30), `Add_AmmoMag` (reserve magazine count).
  - Reload: Pressing `R` plays skeletal mesh montage `FpsAnims_Anim_Rig_AK_Reload_full_Montage`, plays sound `Reloading`, and resets ammo count.
  - World Ammunition: Physical pickup actors (`Ammo_Pickup`) overlap with player capsule and increment magazine reserves.
- **Player Health & Damage:**
  - Uses `Event AnyDamage`.
  - Decrements player `Health` variable; updates `W_Main` progress bar percentage.
  - Triggers red vignette damage screen `W_BloodEffect` and plays `Player_hit` / `Player_Death` audio cues.

### 3.4 Enemy Artificial Intelligence (AI)

| Component | Asset Path | Purpose & Mechanics |
| :--- | :--- | :--- |
| **AI Controller** | `/Game/My_Ai_Bots/MyBot_Controller` | Houses `UAIPerceptionComponent`. Senses player via `AISenseConfig_Sight`. Sets focus actor and Blackboard key `TargetActor`. |
| **Blackboard** | `/Game/My_Ai_Bots/BB_Bot` | Single key: `TargetActor` (`UBlackboardKeyType_Object`). |
| **Behavior Tree** | `/Game/My_Ai_Bots/BT_Bot` | Binary Selector: If `TargetActor` is valid $\rightarrow$ MoveTo + `Shooting_Service`; Else $\rightarrow$ `BTTask_Patroling`. |
| **Shooting Service** | `/Game/My_Ai_Bots/Shooting_Service` | `UBTService_BlueprintBase` ticking every 0.1–0.2s. Fires raycast traces from bot rifle muzzle towards player location. |
| **Enemy Pawn** | `/Game/My_Ai_Bots/BP_Bot` | Mixamo-rigged soldier pawn. Handles `Event AnyDamage`, health subtraction, ragdoll/death animation, and blood splat effects. |
| **Sniper Bot** | `/Game/My_Ai_Bots/Sniper_Bot/BP_SniperBot` | Elevated static guard variant with extended sight radius and high single-shot point damage. |

---

## 4. Input & Controls Mapping

Input handling uses the **Legacy Unreal Engine Input Component** configured in `Config/DefaultInput.ini`:

| Action Name | Default Key | Trigger Condition | Execution Logic in `BP_FPS_Character` |
| :--- | :--- | :--- | :--- |
| **Fire** | `LeftMouseButton` | Pressed / Released | Starts automatic weapon fire timer; fires line-trace, deducts ammo, plays muzzle flash and recoil. |
| **Aim Down Sights (ADS)**| `RightMouseButton`| Pressed / Released | Interpolates camera FOV from 90 to 60; changes camera socket offset; plays zoom audio. |
| **Jump** | `SpaceBar` | Pressed | Invokes `ACharacter::Jump()`; triggers landing camera shake. |
| **Sprint** | `LeftShift` | Pressed / Released | Increases `MaxWalkSpeed` from 600 to 1000; enables sprint head-bob. |
| **Crouch** | `LeftControl` | Pressed / Released | Toggles crouching state; reduces capsule half-height. |
| **Reload** | `R` | Pressed | Checks `Add_AmmoMag > 0`; plays reload montage and updates ammo counters. |
| **Forward/Backward** | `W` / `S` | Axis (+1.0 / -1.0) | `AddMovementInput` along Actor Forward Vector. |
| **Right/Left** | `D` / `A` | Axis (+1.0 / -1.0) | `AddMovementInput` along Actor Right Vector. |
| **Look Up/Down** | `MouseY` | Axis (-1.0) | `AddControllerPitchInput`. |
| **Turn Right/Left** | `MouseX` | Axis (+1.0) | `AddControllerYawInput`. |

---

## 5. Technical Debt, Incomplete Code & Bug Audit

| File / Asset | Location / Node | Severity | Issue / Stub Description | Recommended Architecture Fix |
| :--- | :--- | :--- | :--- | :--- |
| **`Shooting_Service`** | `EventGraph -> Line Trace By Channel` | **Critical** | **Accessed None Runtime Crash:** Calls `Get Focus Actor` and reads location without checking `IsValid`. Throws infinite errors when target is not acquired. | Insert an `Is Valid` validation macro between `Get Focus Actor` and the trace execution. |
| **`BP_SniperBot`** | `EventGraph -> Branch` | **Critical** | **Accessed None Runtime Crash:** Breaks Hit Result and accesses `Hit Actor` when raycast strikes sky or misses all colliders. | Check `bBlockingHit` boolean pin on the trace result before reading `Hit Actor`. |
| **`BTTask_Patroling`** | Full Blueprint | **Critical** | **Dead Stub Code:** The patrol task contains no execution logic or function calls. All guard pawns remain completely frozen in place when not in combat. | Implement patrol waypoint navigation or spline path iteration (see C++ specifications below). |
| **`Sniper_BTTask_Patroling`**| Full Blueprint | **Critical** | **Dead Stub Code:** Empty task body identical to standard bot. | Populate with panoramic scanning rotations or waypoint sweeps. |
| **`My_Ai_Bots/BB_Bot`** | Blackboard Keys | **Warning** | **Lacks Stealth States:** Only has a single key (`TargetActor`). Cannot represent suspicion, investigating sounds, or alert levels. | Add keys: `AlertState` (Enum), `InvestigationPoint` (Vector), `IsAlarmRaised` (Bool). |
| **`BP_FPS_Character`** | Entire Graph | **Warning** | **Monolithic Design:** Weapon data, recoil calculations, ammo counts, and camera shakes are hardcoded into the character pawn. | Refactor into modular C++ components: `UHealthComponent`, `UWeaponInventoryComponent`. |
| **`Config/DefaultInput.ini`** | `ActionMappings` | **Warning** | **Deprecated Legacy Input:** Project relies on legacy input mappings in UE 5.6 where Enhanced Input (`IMC_`, `IA_`) is standard. | Migrate to Enhanced Input Mapping Contexts. |
| **Showcase Assets** | `Content/STF/`, `Content/VigilanteContent/` | **Low** | **Repository Bloat:** 1.5 GB of pre-baked showcase lighting (`*BuiltData.uasset`) and demo levels not used in `_Main_Map`. | Ignored via `.gitignore`; strip permanently prior to packaging. |

---

## 6. Target C++ Architecture for Classic Project I.G.I. Mechanics

To transition this prototype into a true tactical stealth game resembling **Project I.G.I. (I'm Going In)**, the following C++ class hierarchy must be constructed in `/Source/`:

```
Source/IGI_Project/
├── Core/
│   ├── IGI_GameMode.h/.cpp              # Mission objectives, alarm state, fail/success conditions
│   └── IGI_PlayerController.h/.cpp      # Tactical map UI, night vision overlay, binoculars input
├── Character/
│   ├── IGI_CharacterBase.h/.cpp         # Shared base for health, ragdoll, footsteps, noise generation
│   ├── IGI_PlayerCharacter.h/.cpp       # First-person player, stealth visibility rating, stamina
│   └── IGI_EnemyCharacter.h/.cpp        # Guard pawn, headshot multipliers, radio communication
├── Components/
│   ├── IGI_HealthComponent.h/.cpp       # Health pool, armor absorption, damage delegation
│   ├── IGI_StealthComponent.h/.cpp      # Calculates player visibility based on crouching, speed, and shadows
│   └── IGI_InventoryComponent.h/.cpp    # Multi-slot weapon switching (Knife, Silenced Pistol, AK, Sniper)
├── Weapons/
│   ├── IGI_WeaponBase.h/.cpp            # Weapon base actor, raycast ballistics, sound noise emission
│   ├── IGI_SilencedWeapon.h/.cpp        # Zero-noise weapon subtype
│   └── IGI_Projectile.h/.cpp            # Rocket/grenade physical projectiles
├── AI/
│   ├── IGI_AIController.h/.cpp          # Perception manager (Sight, Hearing, Damage)
│   ├── IGI_PatrolPath.h/.cpp            # Spline actor placed in level for guard patrol routes
│   ├── IGI_BTTask_FollowPatrol.h/.cpp   # Behavior tree task querying spline waypoints
│   └── IGI_SurveillanceCamera.h/.cpp    # Rotating camera actor with detection cone and alarm trigger
└── Interactive/
    ├── IGI_AlarmPanel.h/.cpp            # Hackable computer/panel to silence base sirens
    ├── IGI_SecurityDoor.h/.cpp          # Lockpickable / keycard-locked physical door
    └── IGI_WorldPickup.h/.cpp           # First-aid kits, ammo clips, map data laptops
```

### 6.1 Stealth Awareness State Machine
```
   [ IDLE / PATROL ]
          │  (Visual glimpse or distant footstep)
          ▼
   [ SUSPICIOUS ] ──────────────► Inspects disturbance location
          │  (Clear line of sight / gunfire heard)
          ▼
     [ COMBAT ] ────────────────► Attacks player; runs to Alarm Panel
          │  (Alarm Panel triggered)
          ▼
  [ BASE-WIDE ALARM ] ──────────► All reinforcement bots spawn and search
```

---

## 7. Setup & Compilation Guide

### 7.1 Transitioning from Blueprint to C++ Project
1. Open [Fps_Igi_game.uproject](file:///d:/PROJECTS/IGI%20Remake/IGI_Project/Fps_Igi_game.uproject) in Unreal Editor 5.6.
2. Select **Tools $\rightarrow$ New C++ Class...**
3. Choose `None` (Empty C++ class) and name it `IGIGameModule`.
4. Unreal Engine will automatically generate:
   - `/Source/Fps_Igi_game/Fps_Igi_game.Build.cs`
   - `/Source/Fps_Igi_game.Target.cs`
   - `/Source/Fps_Igi_gameEditor.Target.cs`
   - Visual Studio Solution (`.sln`).
5. Update `Fps_Igi_game.uproject` to register the module:
```json
"Modules": [
	{
		"Name": "Fps_Igi_game",
		"Type": "Runtime",
		"LoadingPhase": "Default"
	}
]
```

### 7.2 Building via UnrealBuildTool (UBT) & Live Coding
- **Live Coding:** Press `Ctrl + Alt + F11` inside the Unreal Editor to recompile C++ modifications in memory without restarting the editor.
- **Command-Line Build:**
```cmd
"C:\Program Files\Epic Games\UE_5.6\Engine\Build\BatchFiles\Build.bat" Fps_Igi_gameEditor Win64 Development "d:\PROJECTS\IGI Remake\IGI_Project\Fps_Igi_game.uproject" -waitmutex
```

---

## 8. Roadmap to Completion (I.G.I. Mission 1 Checklist)

- [x] **Phase 1: Engine & Platform Stabilization**
  - [x] Optimize D3D12 and disable Lumen for Intel Graphics compatibility.
  - [x] Configure production `.gitignore`, `.gitattributes`, and Git LFS.
  - [x] Fix critical Blueprint runtime errors in `Shooting_Service` and `BP_SniperBot`.

- [ ] **Phase 2: Core C++ Architecture Bootstrap**
  - [ ] Generate project source code scaffolding (`/Source/`).
  - [ ] Implement `IGI_HealthComponent` and `IGI_WeaponBase`.
  - [ ] Migrate `BP_FPS_Character` weapon logic to modular C++ inventory.
  - [ ] Migrate input system to Enhanced Input (`IMC_Default`, `IA_Fire`, `IA_Move`, `IA_Look`).

- [ ] **Phase 3: Tactical Stealth & AI Mechanics**
  - [ ] Implement `IGI_PatrolPath` spline actor and populate `BTTask_Patroling`.
  - [ ] Add 4-tier awareness state machine: `Idle` $\rightarrow$ `Suspicious` $\rightarrow$ `Investigating` $\rightarrow$ `Combat`.
  - [ ] Create `IGI_SurveillanceCamera` with visual cone mesh and laser detection.
  - [ ] Implement security alarm system with siren audio and base-wide notification dispatchers.
  - [ ] Add silent melee / knife takedown mechanic from behind guards.

- [ ] **Phase 4: Level Objectives & Mission Logic**
  - [ ] Set up Mission 1 Objectives: Infiltrate Compound, Hack Computer in Big Warehouse, Escape via Helipad.
  - [ ] Add lockpicking mini-game / interaction prompt on base security gates.
  - [ ] Implement interactive Alarm Control Panels allowing player to deactivate sirens.
  - [ ] Place ammunition pickups, medkits, and surveillance cameras throughout `_Main_Map`.

- [ ] **Phase 5: Audio & Polish**
  - [ ] Convert 2D guard voice lines into 3D spatialized audio attenuation.
  - [ ] Add footstep noise radius based on surface material (Concrete, Metal, Wood, Snow).
  - [ ] Package standalone Windows 64-bit Shipping build.
