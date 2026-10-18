import * as THREE from 'three';
import type {
  EnemyData,
  GameSettings,
  MissionDefinition,
  MissionId,
  MissionObjective,
  WeaponData,
} from '../../types/game';
import type { MapData } from '../MapBuilder';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { EventBus } from './EventBus';
import type { InputSystem } from '../systems/InputSystem';
import type { PlayerController } from '../systems/PlayerController';
import type { WeaponSystem } from '../systems/WeaponSystem';
import type { AISystem } from '../systems/AISystem';
import type { VFXSystem } from '../systems/VFXSystem';
import type { WorldSystem } from '../systems/WorldSystem';
import type { InteractionSystem } from '../systems/InteractionSystem';
import type { ObjectiveSystem } from '../systems/ObjectiveSystem';
import type { HudBridge } from '../systems/HudBridge';

export interface HudPayload {
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
  enemies: EnemyData[];
  leanOffset: number;
  isNightVision: boolean;
  isBinoculars: boolean;
  nvgBattery: number;
  targetDistance: number | null;
  targetedEnemy: EnemyData | null;
  grenades?: number;
  c4Count?: number;
  c4Planted?: boolean;
  powerCut?: boolean;
  fps?: number;
}

export interface MissionEndStats {
  kills: number;
  headshots: number;
  time: number;
  shotsFired: number;
  accuracy: number;
  alarms: number;
}

export interface GameEngineCallbacks {
  onHudUpdate: (data: HudPayload) => void;
  onMissionEnd: (victory: boolean, stats: MissionEndStats) => void;
}

export interface EnemyEntry {
  data: EnemyData;
  mesh: THREE.Group;
  visorMat: THREE.MeshBasicMaterial;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  walkCycle: number;
  isDead: boolean;
  deathAnimTime: number;
}

export interface PlayerState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  stamina: number;
  isSprinting: boolean;
  isCrouching: boolean;
  isGrounded: boolean;
  eyeHeight: number;
  targetEyeHeight: number;
  currentLean: number;
  targetLean: number;
  actualLeanOffset: number;
  bobTimer: number;
  footstepTimer: number;
  recoilPitch: number;
  recoilYaw: number;
  isNightVision: boolean;
  nvgBattery: number;
  isBinoculars: boolean;
  isAiming: boolean;
  grenades: number;
  c4Count: number;
  c4Planted: boolean;
  hasKeycard: boolean;
}

export interface Systems {
  input: InputSystem;
  player: PlayerController;
  weapons: WeaponSystem;
  ai: AISystem;
  vfx: VFXSystem;
  world: WorldSystem;
  interaction: InteractionSystem;
  objectives: ObjectiveSystem;
  hud: HudBridge;
}

/** Every per-frame system implements this. */
export interface GameSystem {
  update(dt: number): void;
  dispose?(): void;
}

/**
 * Shared mutable state for one mission session. Systems read and write through this
 * object instead of reaching into a monolithic engine class.
 */
export class GameContext {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public settings: GameSettings;
  public readonly missionId: MissionId;
  public readonly missionDef: MissionDefinition;
  public readonly callbacks: GameEngineCallbacks;
  public readonly events: EventBus;
  public physics!: PhysicsWorld;
  public mapData!: MapData;
  public systems!: Systems;

  public ambientLight!: THREE.AmbientLight;
  public sunOrMoonLight!: THREE.DirectionalLight;

  public player: PlayerState;
  public enemies: EnemyEntry[] = [];
  public objectives: MissionObjective[] = [];

  public stats = {
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    alarms: 0,
    startTime: Date.now(),
  };

  public feedback = {
    hitMarkerTimer: 0,
    isHeadshotHit: false,
    damageDirection: null as number | null,
    damageDirectionTimer: 0,
    prompt: null as string | null,
  };

  public alarm = { active: false, triggerTime: 0 };
  public extraction = { isExtracting: false, holdTimer: 0 };

  /** Seconds since mission start (paused time excluded). */
  public time = 0;
  public fps = 60;
  public isPaused = false;
  public hasEnded = false;

  constructor(opts: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    settings: GameSettings;
    missionId: MissionId;
    missionDef: MissionDefinition;
    callbacks: GameEngineCallbacks;
    events: EventBus;
  }) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.renderer = opts.renderer;
    this.settings = opts.settings;
    this.missionId = opts.missionId;
    this.missionDef = opts.missionDef;
    this.callbacks = opts.callbacks;
    this.events = opts.events;

    const d = opts.missionDef;
    this.player = {
      pos: new THREE.Vector3(d.startPosition[0], d.startPosition[1], d.startPosition[2]),
      vel: new THREE.Vector3(),
      yaw: d.startYaw,
      pitch: 0,
      health: 100,
      armor: 100,
      stamina: 100,
      isSprinting: false,
      isCrouching: false,
      isGrounded: true,
      eyeHeight: 1.7,
      targetEyeHeight: 1.7,
      currentLean: 0,
      targetLean: 0,
      actualLeanOffset: 0,
      bobTimer: 0,
      footstepTimer: 0,
      recoilPitch: 0,
      recoilYaw: 0,
      isNightVision: false,
      nvgBattery: 100,
      isBinoculars: false,
      isAiming: false,
      grenades: 3,
      c4Count: 2,
      c4Planted: false,
      hasKeycard: false,
    };

    this.objectives = [
      ...d.primaryObjectives.map((o) => ({ ...o, isCompleted: false, isOptional: false })),
      ...d.secondaryObjectives.map((o) => ({ ...o, isCompleted: false, isOptional: true })),
    ];
  }

  /** Camera rotation including recoil offsets. */
  public getAimEuler(target = new THREE.Euler()): THREE.Euler {
    return target.set(this.player.pitch + this.player.recoilPitch, this.player.yaw + this.player.recoilYaw, 0, 'YXZ');
  }
}
