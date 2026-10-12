import * as THREE from 'three';
import { soundManager } from '../audio/SoundManager';
import {
  CAMPAIGN_MISSIONS,
  EnemyAlertState,
  EnemyData,
  EnemyRole,
  GameSettings,
  MissionDefinition,
  MissionId,
  MissionObjective,
  WeaponData,
  WeaponId,
} from '../types/game';
import { EnemyMeshFactory } from './EnemyMeshFactory';
import { ExplosiveBarrel, InteractiveItem, MapBuilder, MapData, SurveillanceCameraMesh } from './MapBuilder';
import { WeaponMeshFactory } from './WeaponMeshFactory';

export interface GameEngineCallbacks {
  onHudUpdate: (data: {
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
  }) => void;
  onMissionEnd: (
    victory: boolean,
    stats: {
      kills: number;
      headshots: number;
      time: number;
      shotsFired: number;
      accuracy: number;
      alarms: number;
    }
  ) => void;
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

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private settings: GameSettings;
  private missionId: MissionId;
  private missionDef: MissionDefinition;

  // Three.js Core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private animFrameId: number | null = null;

  // Environment & Lights
  private ambientLight!: THREE.AmbientLight;
  private sunOrMoonLight!: THREE.DirectionalLight;
  private mapData!: MapData;

  // Player State
  private playerPos = new THREE.Vector3(0, 1.7, 58);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private yaw = Math.PI;
  private pitch = 0;
  private isPointerLocked = false;
  private keys: Record<string, boolean> = {};

  // Player Combat & Vitals
  private health = 100;
  private armor = 100;
  private stamina = 100;
  private isSprinting = false;
  private isCrouching = false;
  private isGrounded = true;
  private eyeHeight = 1.7;
  private targetEyeHeight = 1.7;
  private currentLean = 0;
  private targetLean = 0;
  private actualLeanOffset = 0;

  // Tactical Gear (NVG & Binoculars)
  private isNightVision = false;
  private nvgBattery = 100;
  private isBinoculars = false;
  private targetedEnemy: EnemyData | null = null;
  private targetDistance: number | null = null;

  // Bobbing & Recoil
  private bobTimer = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;

  // Weapons & Inventory
  private weapons: WeaponData[] = [
    {
      id: 'knife',
      name: 'Ka-Bar Combat Knife',
      slot: 1,
      ammo: 1,
      magSize: 1,
      reserve: 0,
      damage: 100,
      fireRate: 2.2,
      range: 2.5,
      spread: 0,
      recoil: 0.01,
      reloadTime: 0,
      isSilenced: true,
      isAutomatic: false,
      zoomFov: 75,
      description: 'Lethal silent takedown weapon. No audible noise.',
    },
    {
      id: 'silenced_pistol',
      name: 'M9SD Silenced 9mm',
      slot: 2,
      ammo: 15,
      magSize: 15,
      reserve: 45,
      damage: 40,
      fireRate: 4.5,
      range: 45,
      spread: 0.012,
      recoil: 0.025,
      reloadTime: 1.6,
      isSilenced: true,
      isAutomatic: false,
      zoomFov: 55,
      description: 'Suppressed handgun. Moderate damage, zero noise signature.',
    },
    {
      id: 'ak74m',
      name: 'AK-74M Assault Rifle',
      slot: 3,
      ammo: 30,
      magSize: 30,
      reserve: 120,
      damage: 48,
      fireRate: 9.5,
      range: 90,
      spread: 0.024,
      recoil: 0.045,
      reloadTime: 2.3,
      isSilenced: false,
      isAutomatic: true,
      zoomFov: 50,
      description: 'Standard military rifle. High stopping power, full automatic.',
    },
    {
      id: 'sniper',
      name: 'Dragunov SVD Sniper',
      slot: 4,
      ammo: 10,
      magSize: 10,
      reserve: 30,
      damage: 110,
      fireRate: 1.8,
      range: 160,
      spread: 0.004,
      recoil: 0.075,
      reloadTime: 2.8,
      isSilenced: false,
      isAutomatic: false,
      zoomFov: 16,
      description: 'High-caliber marksman rifle with Russian PSO-1 optical reticle.',
    },
  ];
  private currentWeaponIdx = 1;
  private isAiming = false;
  private isReloading = false;
  private reloadTimer = 0;
  private shootCooldown = 0;
  private isMouseDown = false;

  // 3D Weapon Rig
  private weaponMeshGroup!: THREE.Group;
  private currentWeaponMesh: THREE.Group | null = null;
  private muzzleFlashLight!: THREE.PointLight;
  private bulletTracers: { line: THREE.Line; age: number }[] = [];
  private bulletDecals: THREE.Mesh[] = [];

  // Enemies & AI
  private enemies: EnemyEntry[] = [];
  private baseAlarmActive = false;
  private alarmTriggerTime = 0;

  // Objectives
  private objectives: MissionObjective[] = [];

  // Stats
  private stats = {
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    alarms: 0,
    startTime: Date.now(),
  };

  // Feedback states
  private hitMarkerTimer = 0;
  private damageDirection: number | null = null;
  private damageDirectionTimer = 0;
  private currentPrompt: string | null = null;
  private footstepTimer = 0;
  private extractHoldTimer = 0;
  private isExtracting = false;

  constructor(
    container: HTMLElement,
    callbacks: GameEngineCallbacks,
    initialSettings: GameSettings,
    missionId: MissionId = 'mission_01'
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.settings = initialSettings;
    this.missionId = missionId;

    const def = CAMPAIGN_MISSIONS.find((m) => m.id === missionId) || CAMPAIGN_MISSIONS[0];
    this.missionDef = def;

    // Set initial player position from mission
    this.playerPos.set(def.startPosition[0], def.startPosition[1], def.startPosition[2]);
    this.yaw = def.startYaw;

    // Load mission objectives
    this.objectives = [
      ...def.primaryObjectives.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        isCompleted: false,
        isOptional: false,
        markerPos: o.markerPos,
      })),
      ...def.secondaryObjectives.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        isCompleted: false,
        isOptional: true,
        markerPos: o.markerPos,
      })),
    ];

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.setupEnvironmentLighting();

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(
      this.settings.fieldOfView,
      window.innerWidth / window.innerHeight,
      0.1,
      350
    );
    this.camera.position.copy(this.playerPos);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.applyShadowSettings();
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // 4. Build Map
    this.mapData = MapBuilder.buildCompound(this.scene, this.missionId);

    // 5. First Person Weapon Rig
    this.setupWeaponRig();

    // 6. Spawn Mission Enemies
    this.spawnEnemies();

    // 7. Event Listeners
    this.setupInputListeners();

    // 8. Apply audio volumes
    soundManager.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.settings.ambientVolume);

    // 9. Start Loop
    this.startLoop();
  }

  public updateSettings(newSettings: GameSettings) {
    this.settings = newSettings;
    this.camera.fov = this.isAiming
      ? this.weapons[this.currentWeaponIdx].zoomFov
      : this.isBinoculars
      ? 12
      : this.settings.fieldOfView;
    this.camera.updateProjectionMatrix();

    this.applyShadowSettings();
    soundManager.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.settings.ambientVolume);
  }

  private applyShadowSettings() {
    if (this.settings.shadowQuality === 'off') {
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type =
        this.settings.shadowQuality === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    }
  }

  private setupEnvironmentLighting() {
    const env = this.missionDef.environment;

    if (env === 'daylight_radar') {
      // Mission 2: High-Noon Daylight
      this.scene.background = new THREE.Color(0xdbeafe);
      this.scene.fog = new THREE.Fog(0xdbeafe, 50, 220);

      this.ambientLight = new THREE.AmbientLight(0xfff7ed, 1.5);
      this.scene.add(this.ambientLight);

      this.sunOrMoonLight = new THREE.DirectionalLight(0xfef08a, 2.6);
      this.sunOrMoonLight.position.set(50, 120, 40);
      this.sunOrMoonLight.castShadow = this.settings.shadowQuality !== 'off';
    } else if (env === 'mountain_dawn') {
      // Mission 3: Mountain Dawn
      this.scene.background = new THREE.Color(0x334155);
      this.scene.fog = new THREE.FogExp2(0x334155, 0.013);

      this.ambientLight = new THREE.AmbientLight(0x475569, 1.2);
      this.scene.add(this.ambientLight);

      this.sunOrMoonLight = new THREE.DirectionalLight(0xfdba74, 2.2);
      this.sunOrMoonLight.position.set(80, 35, -45);
      this.sunOrMoonLight.castShadow = this.settings.shadowQuality !== 'off';
    } else {
      // Mission 1: Cold War Night Depot
      this.scene.background = new THREE.Color(0x0a0e14);
      this.scene.fog = new THREE.FogExp2(0x0c1119, 0.012);

      this.ambientLight = new THREE.AmbientLight(0x27364d, 0.85);
      this.scene.add(this.ambientLight);

      this.sunOrMoonLight = new THREE.DirectionalLight(0x7dd3fc, 0.95);
      this.sunOrMoonLight.position.set(40, 80, 50);
      this.sunOrMoonLight.castShadow = this.settings.shadowQuality !== 'off';
    }

    if (this.sunOrMoonLight) {
      this.sunOrMoonLight.shadow.mapSize.width = 1024;
      this.sunOrMoonLight.shadow.mapSize.height = 1024;
      this.sunOrMoonLight.shadow.camera.near = 10;
      this.sunOrMoonLight.shadow.camera.far = 200;
      this.sunOrMoonLight.shadow.camera.left = -90;
      this.sunOrMoonLight.shadow.camera.right = 90;
      this.sunOrMoonLight.shadow.camera.top = 90;
      this.sunOrMoonLight.shadow.camera.bottom = -90;
      this.scene.add(this.sunOrMoonLight);
    }
  }

  private setupWeaponRig() {
    this.weaponMeshGroup = new THREE.Group();
    this.camera.add(this.weaponMeshGroup);
    this.scene.add(this.camera);

    this.muzzleFlashLight = new THREE.PointLight(0xffedd5, 0, 10);
    this.muzzleFlashLight.position.set(0.18, -0.15, -0.7);
    this.camera.add(this.muzzleFlashLight);

    this.updateWeaponMesh();
  }

  private updateWeaponMesh() {
    if (!this.weaponMeshGroup) return;

    while (this.weaponMeshGroup.children.length > 0) {
      this.weaponMeshGroup.remove(this.weaponMeshGroup.children[0]);
    }

    const cur = this.weapons[this.currentWeaponIdx];
    this.currentWeaponMesh = WeaponMeshFactory.createWeaponMesh(cur.id);
    this.weaponMeshGroup.add(this.currentWeaponMesh);
  }

  private spawnEnemies() {
    let configs: {
      id: string;
      name: string;
      role: EnemyRole;
      pos: [number, number, number];
      patrol: [number, number, number][];
      health: number;
    }[] = [];

    if (this.missionId === 'mission_02') {
      // Daylight Radar Outpost roster
      configs = [
        {
          id: 'guard_gate_desert',
          name: 'Gate Sentry Rashidov',
          role: 'patrol',
          pos: [0, 0, 52],
          patrol: [[0, 0, 52], [-8, 0, 52], [8, 0, 52]],
          health: 85,
        },
        {
          id: 'guard_radar_courtyard',
          name: 'Courtyard Patrol Alimov',
          role: 'patrol',
          pos: [10, 0, 30],
          patrol: [[10, 0, 30], [24, 0, 30], [24, 0, 5], [10, 0, 5]],
          health: 90,
        },
        {
          id: 'guard_generator',
          name: 'Substation Guard Tursunov',
          role: 'heavy',
          pos: [-24, 0, -14],
          patrol: [[-24, 0, -14], [-32, 0, -14], [-32, 0, -22]],
          health: 120,
        },
        {
          id: 'guard_officer',
          name: 'Comms Officer Major Sorokin',
          role: 'officer',
          pos: [0, 0, -8],
          patrol: [[0, 0, -8], [-5, 0, -8], [5, 0, -8]],
          health: 140,
        },
        {
          id: 'sniper_se_desert',
          name: 'Tower Sniper Kasymov',
          role: 'sniper',
          pos: [50, 9.2, 50],
          patrol: [[50, 9.2, 50]],
          health: 70,
        },
        {
          id: 'sniper_nw_desert',
          name: 'Tower Sniper Dzhuraev',
          role: 'sniper',
          pos: [-50, 9.2, -50],
          patrol: [[-50, 9.2, -50]],
          health: 70,
        },
      ];
    } else if (this.missionId === 'mission_03') {
      // Mountain Dawn Silo roster
      configs = [
        {
          id: 'guard_mountain_gate',
          name: 'Bastion Sentry Romanov',
          role: 'patrol',
          pos: [0, 0, 52],
          patrol: [[0, 0, 52], [-6, 0, 52], [6, 0, 52]],
          health: 90,
        },
        {
          id: 'guard_silo_pit',
          name: 'Silo Perimeter Heavy Borisov',
          role: 'heavy',
          pos: [0, 0, 16],
          patrol: [[0, 0, 16], [-10, 0, 16], [10, 0, 16]],
          health: 140,
        },
        {
          id: 'guard_dynamo',
          name: 'Pillbox Dynamo Guard Fedorov',
          role: 'patrol',
          pos: [28, 0, 18],
          patrol: [[28, 0, 18], [34, 0, 18], [34, 0, 24]],
          health: 95,
        },
        {
          id: 'guard_commander',
          name: 'Base Commander Col. Zaitsev',
          role: 'officer',
          pos: [25, 0, -15],
          patrol: [[25, 0, -15], [20, 0, -15], [20, 0, -10]],
          health: 180,
        },
        {
          id: 'sniper_se_mountain',
          name: 'Mountain Marksman Gerasimov',
          role: 'sniper',
          pos: [45, 9.2, 45],
          patrol: [[45, 9.2, 45]],
          health: 75,
        },
        {
          id: 'sniper_nw_mountain',
          name: 'Mountain Marksman Chernov',
          role: 'sniper',
          pos: [-45, 9.2, -45],
          patrol: [[-45, 9.2, -45]],
          health: 75,
        },
      ];
    } else {
      // Mission 1: Night Depot roster
      configs = [
        {
          id: 'guard_gate',
          name: 'Gate Sentry Ivanov',
          role: 'patrol',
          pos: [5, 0, 48],
          patrol: [[5, 0, 48], [-5, 0, 48], [5, 0, 58]],
          health: 80,
        },
        {
          id: 'guard_courtyard',
          name: 'Patrol Sergeant Morozov',
          role: 'patrol',
          pos: [0, 0, 20],
          patrol: [[0, 0, 20], [16, 0, 20], [16, 0, -5], [0, 0, -5]],
          health: 90,
        },
        {
          id: 'guard_warehouse_dock',
          name: 'Warehouse Guard Petrov',
          role: 'patrol',
          pos: [-14, 0, 12],
          patrol: [[-14, 0, 12], [-14, 0, -8], [-10, 0, 2]],
          health: 85,
        },
        {
          id: 'guard_warehouse_interior',
          name: 'Special Security Volkov',
          role: 'heavy',
          pos: [-28, 0, 8],
          patrol: [[-28, 0, 8], [-35, 0, 8], [-32, 0, 15]],
          health: 120,
        },
        {
          id: 'guard_admin',
          name: 'Office Guard Kozlov',
          role: 'patrol',
          pos: [20, 0, -10],
          patrol: [[20, 0, -10], [20, 0, -2], [28, 0, -10]],
          health: 85,
        },
        {
          id: 'sniper_se',
          name: 'Tower Sniper Sokolov',
          role: 'sniper',
          pos: [45, 9.2, 45],
          patrol: [[45, 9.2, 45]],
          health: 65,
        },
        {
          id: 'sniper_nw',
          name: 'Tower Sniper Belov',
          role: 'sniper',
          pos: [-45, 9.2, -45],
          patrol: [[-45, 9.2, -45]],
          health: 65,
        },
      ];
    }

    configs.forEach((cfg) => {
      const { group, visorMat, bodyGroup, leftLeg, rightLeg } = EnemyMeshFactory.createSoldierMesh(cfg.role);
      group.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      this.scene.add(group);

      const enemyData: EnemyData = {
        id: cfg.id,
        name: cfg.name,
        role: cfg.role,
        health: cfg.health,
        maxHealth: cfg.health,
        alertState: 'idle',
        suspicionMeter: 0,
        position: cfg.pos,
        patrolPoints: cfg.patrol,
        currentPatrolIdx: 0,
        lastKnownPlayerPos: null,
        shootCooldown: 0.5 + Math.random() * 0.8,
        burstCount: 0,
        isTagged: false,
      };

      this.enemies.push({
        data: enemyData,
        mesh: group,
        visorMat,
        bodyGroup,
        leftLeg,
        rightLeg,
        walkCycle: Math.random() * 10,
        isDead: false,
        deathAnimTime: 0,
      });
    });
  }

  private setupInputListeners() {
    const handleCanvasClick = () => {
      if (!this.isPointerLocked) {
        this.renderer.domElement.requestPointerLock();
      }
    };
    this.renderer.domElement.addEventListener('click', handleCanvasClick);

    const handlePointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isPointerLocked) return;
      const sens = 0.0022 * this.settings.mouseSensitivity;
      this.yaw -= e.movementX * sens;
      const pitchDelta = e.movementY * sens * (this.settings.invertY ? 1 : -1);
      this.pitch -= pitchDelta;
      const maxPitch = Math.PI / 2.05;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    };
    document.addEventListener('mousemove', handleMouseMove);

    const handleMouseDown = (e: MouseEvent) => {
      if (!this.isPointerLocked) return;
      if (e.button === 0) {
        if (this.isBinoculars) {
          this.tagCurrentTarget();
        } else {
          this.isMouseDown = true;
          this.triggerFire();
        }
      } else if (e.button === 2) {
        if (!this.isBinoculars) {
          this.isAiming = true;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      } else if (e.button === 2) {
        this.isAiming = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);

    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;

      if (e.code === 'Digit1') this.switchWeapon(0);
      if (e.code === 'Digit2') this.switchWeapon(1);
      if (e.code === 'Digit3') this.switchWeapon(2);
      if (e.code === 'Digit4') this.switchWeapon(3);

      if (e.code === 'KeyR') this.triggerReload();
      if ((e.code === 'KeyF' || e.code === 'KeyE') && this.currentPrompt) this.triggerInteraction();
      if (e.code === 'KeyN') this.toggleNightVision();
      if (e.code === 'KeyB') this.toggleBinoculars();
      if (e.code === 'ControlLeft' || e.code === 'KeyC') {
        this.isCrouching = !this.isCrouching;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyF' || e.code === 'KeyE') {
        if (!this.isExtracting) this.extractHoldTimer = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
  }

  public toggleNightVision() {
    this.isNightVision = !this.isNightVision;
    soundManager.playNightVisionToggle(this.isNightVision);

    if (this.isNightVision) {
      this.ambientLight.intensity = 2.4;
      this.ambientLight.color.setHex(0x10b981);
    } else {
      if (this.missionDef.environment === 'daylight_radar') {
        this.ambientLight.intensity = 1.5;
        this.ambientLight.color.setHex(0xfff7ed);
      } else if (this.missionDef.environment === 'mountain_dawn') {
        this.ambientLight.intensity = 1.2;
        this.ambientLight.color.setHex(0x475569);
      } else {
        this.ambientLight.intensity = 0.85;
        this.ambientLight.color.setHex(0x27364d);
      }
    }
  }

  public toggleBinoculars() {
    this.isBinoculars = !this.isBinoculars;
    this.isAiming = false;
    soundManager.playBinocularsZoom();

    if (this.currentWeaponMesh) {
      this.currentWeaponMesh.visible = !this.isBinoculars;
    }
  }

  public tagCurrentTarget() {
    if (this.targetedEnemy) {
      this.targetedEnemy.isTagged = true;
      soundManager.playHitMarker();
    }
  }

  private switchWeapon(idx: number) {
    if (this.isBinoculars) this.toggleBinoculars();
    if (idx === this.currentWeaponIdx || idx < 0 || idx >= this.weapons.length || this.isReloading) return;
    this.currentWeaponIdx = idx;
    this.isAiming = false;
    this.shootCooldown = 0.3;
    soundManager.playFootstep(false, true);
    this.updateWeaponMesh();
  }

  // =========================================================================
  // RIGID BALLISTICS: MUZZLE CHECK & OBSTACLE OCCLUSION (NO SHOOTING THROUGH WALLS)
  // =========================================================================

  private triggerFire() {
    if (this.isBinoculars) return;
    const cur = this.weapons[this.currentWeaponIdx];
    if (this.isReloading || this.shootCooldown > 0) return;

    if (cur.ammo <= 0) {
      soundManager.playDryFire();
      this.shootCooldown = 0.3;
      return;
    }

    cur.ammo--;
    this.stats.shotsFired++;
    this.shootCooldown = 1 / cur.fireRate;

    // Weapon Sound
    if (cur.id === 'ak74m') soundManager.playAk74mShot();
    else if (cur.id === 'silenced_pistol') soundManager.playSilencedShot();
    else if (cur.id === 'sniper') soundManager.playSniperShot();
    else soundManager.playKnifeSlash();

    // Sound alert to guards
    if (!cur.isSilenced) {
      this.alertEnemiesBySound(this.playerPos, cur.id === 'sniper' ? 65 : 45);
    }

    // Recoil
    this.recoilPitch = cur.recoil;
    this.recoilYaw = (Math.random() - 0.5) * cur.recoil * 0.6;

    // Muzzle Flash
    if (this.muzzleFlashLight && cur.id !== 'knife') {
      this.muzzleFlashLight.intensity = cur.isSilenced ? 0.8 : 3.5;
      setTimeout(() => {
        if (this.muzzleFlashLight) this.muzzleFlashLight.intensity = 0;
      }, 45);
    }

    this.fireRaycast(cur);
  }

  private fireRaycast(weapon: WeaponData) {
    const spread = this.isAiming ? weapon.spread * 0.3 : weapon.spread;
    const spreadX = (Math.random() - 0.5) * spread;
    const spreadY = (Math.random() - 0.5) * spread;

    // Compute Physical Muzzle Position in World Space
    const muzzleOffset = new THREE.Vector3(0.18, -0.15, -0.4);
    const cameraRot = new THREE.Euler(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ');
    const physicalMuzzle = this.camera.position.clone().add(muzzleOffset.clone().applyEuler(cameraRot));

    // CHECK BARREL OBSTRUCTION: If muzzle is embedded into a wall or crate directly in front!
    let barrelBlocked = false;
    for (const box of this.mapData.colliders) {
      if (box.containsPoint(physicalMuzzle)) {
        barrelBlocked = true;
        break;
      }
    }
    if (barrelBlocked) {
      // Shot strikes the wall surface directly at the muzzle
      this.createHitSparks(physicalMuzzle);
      this.createBulletDecal(physicalMuzzle);
      soundManager.playMetalRicochet();
      return;
    }

    // Direction vector from camera to reticle target
    const shootDir = new THREE.Vector3(spreadX, spreadY, -1).applyEuler(cameraRot).normalize();
    const rayOrigin = this.camera.position.clone();
    const raycaster = new THREE.Raycaster(rayOrigin, shootDir, 0.05, weapon.range);

    // 1. HARD OBSTACLE CHECK: Check all scene colliders (walls, crates, bunkers, barriers)
    let minObstacleDist = weapon.range;
    let obstacleHitPoint: THREE.Vector3 | null = null;

    for (const collider of this.mapData.colliders) {
      const hitPt = new THREE.Vector3();
      if (raycaster.ray.intersectBox(collider, hitPt)) {
        const d = rayOrigin.distanceTo(hitPt);
        if (d < minObstacleDist) {
          minObstacleDist = d;
          obstacleHitPoint = hitPt.clone();
        }
      }
    }

    // 2. EXPLOSIVE BARRELS
    let barrelHit: { barrel: ExplosiveBarrel; dist: number } | null = null;
    for (const barrel of this.mapData.explosiveBarrels) {
      if (barrel.isExploded) continue;
      const bHitPt = new THREE.Vector3();
      const bBox = new THREE.Box3().setFromObject(barrel.mesh);
      if (raycaster.ray.intersectBox(bBox, bHitPt)) {
        const d = rayOrigin.distanceTo(bHitPt);
        if (d < minObstacleDist && d < weapon.range) {
          minObstacleDist = d;
          obstacleHitPoint = bHitPt.clone();
          barrelHit = { barrel, dist: d };
        }
      }
    }

    // 3. SURVEILLANCE CAMERAS
    let cameraHit: SurveillanceCameraMesh | null = null;
    for (const cam of this.mapData.cameras) {
      if (cam.isDestroyed) continue;
      const camPos = cam.mount.position;
      const d = raycaster.ray.distanceToPoint(camPos);
      const distFromPlayer = rayOrigin.distanceTo(camPos);
      if (d < 0.45 && distFromPlayer < minObstacleDist) {
        minObstacleDist = distFromPlayer;
        obstacleHitPoint = camPos.clone();
        cameraHit = cam;
      }
    }

    // 4. ENEMIES: Can ONLY be hit if enemy is CLOSER than the nearest obstacle!
    let closestEnemyHit: { enemy: EnemyEntry; dist: number; isHeadshot: boolean } | null = null;

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;

      const enemyEyePos = new THREE.Vector3(enemy.mesh.position.x, enemy.mesh.position.y + 1.6, enemy.mesh.position.z);
      const enemyBodyPos = new THREE.Vector3(enemy.mesh.position.x, enemy.mesh.position.y + 1.0, enemy.mesh.position.z);

      const dEye = raycaster.ray.distanceToPoint(enemyEyePos);
      const dBody = raycaster.ray.distanceToPoint(enemyBodyPos);
      const distFromPlayer = rayOrigin.distanceTo(enemy.mesh.position);

      // STRICT BALLISTICS: Must NOT be behind an intervening wall, crate, or barrier!
      if (distFromPlayer < minObstacleDist) {
        if (dEye < 0.32) {
          if (!closestEnemyHit || distFromPlayer < closestEnemyHit.dist) {
            closestEnemyHit = { enemy, dist: distFromPlayer, isHeadshot: true };
          }
        } else if (dBody < 0.55) {
          if (!closestEnemyHit || distFromPlayer < closestEnemyHit.dist) {
            closestEnemyHit = { enemy, dist: distFromPlayer, isHeadshot: false };
          }
        }
      }
    }

    let finalHitPoint = obstacleHitPoint ?? rayOrigin.clone().add(shootDir.clone().multiplyScalar(weapon.range));

    // Resolve Hit
    if (closestEnemyHit) {
      const e = closestEnemyHit.enemy;
      const dmg = closestEnemyHit.isHeadshot ? weapon.damage * 2.5 : weapon.damage;
      e.data.health -= dmg;
      this.stats.shotsHit++;
      if (closestEnemyHit.isHeadshot) this.stats.headshots++;

      this.hitMarkerTimer = 0.2;
      soundManager.playHitMarker();
      soundManager.playFleshHit();

      const bloodPos = e.mesh.position.clone().add(new THREE.Vector3(0, closestEnemyHit.isHeadshot ? 1.6 : 1.1, 0));
      this.createBloodParticles(bloodPos);
      finalHitPoint = bloodPos;

      if (e.data.health <= 0) {
        this.killEnemy(e);
      } else {
        e.data.alertState = 'combat';
        e.data.suspicionMeter = 100;
        e.data.lastKnownPlayerPos = [this.playerPos.x, this.playerPos.y, this.playerPos.z];
        EnemyMeshFactory.updateVisorColor(e.visorMat, 'combat');
        soundManager.playGuardVoice('spotted');
        this.alertEnemiesBySound(e.mesh.position, 25);
      }
    } else if (barrelHit) {
      barrelHit.barrel.health -= weapon.damage;
      this.createHitSparks(finalHitPoint);
      soundManager.playMetalRicochet();
      if (barrelHit.barrel.health <= 0) {
        this.explodeBarrel(barrelHit.barrel);
      }
    } else if (cameraHit) {
      cameraHit.isDestroyed = true;
      cameraHit.lightCone.visible = false;
      cameraHit.light.intensity = 0;
      this.createHitSparks(finalHitPoint);
      soundManager.playMetalRicochet();
    } else if (obstacleHitPoint) {
      // Solid Wall/Crate/Object hit: bullet stops here, zero penetration!
      this.createHitSparks(finalHitPoint);
      this.createBulletDecal(finalHitPoint);
      soundManager.playMetalRicochet();
    }

    // Tracer line
    if (weapon.id !== 'knife') {
      this.createBulletTracer(physicalMuzzle, finalHitPoint);
    }
  }

  private createBulletDecal(pos: THREE.Vector3) {
    if (this.bulletDecals.length > 25) {
      const old = this.bulletDecals.shift();
      if (old) this.scene.remove(old);
    }

    const decalGeo = new THREE.PlaneGeometry(0.15, 0.15);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0x18181b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.position.copy(pos);
    decal.lookAt(this.camera.position);
    this.scene.add(decal);
    this.bulletDecals.push(decal);
  }

  private triggerReload() {
    const cur = this.weapons[this.currentWeaponIdx];
    if (this.isReloading || cur.ammo === cur.magSize || cur.reserve <= 0 || cur.id === 'knife') return;

    this.isReloading = true;
    this.reloadTimer = cur.reloadTime;
    soundManager.playReload();
  }

  private triggerInteraction() {
    let nearestItem: InteractiveItem | null = null;
    let minDist = 3.4;

    for (const item of this.mapData.interactiveItems) {
      if (item.isCollected) continue;
      const dist = this.playerPos.distanceTo(item.position);
      if (dist < minDist) {
        minDist = dist;
        nearestItem = item;
      }
    }

    if (!nearestItem) return;

    if (nearestItem.type === 'ammo') {
      nearestItem.isCollected = true;
      this.scene.remove(nearestItem.mesh);
      this.weapons[1].reserve += 15;
      this.weapons[2].reserve += 30;
      this.weapons[3].reserve += 10;
      soundManager.playPickup();
    } else if (nearestItem.type === 'medkit') {
      nearestItem.isCollected = true;
      this.scene.remove(nearestItem.mesh);
      this.health = Math.min(100, this.health + 50);
      this.armor = Math.min(100, this.armor + 25);
      soundManager.playPickup();
    } else if (nearestItem.type === 'briefcase') {
      nearestItem.isCollected = true;
      this.scene.remove(nearestItem.mesh);
      const obj = this.objectives.find((o) => o.id === 'obj_briefcase');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    } else if (nearestItem.type === 'alarm_console') {
      this.baseAlarmActive = false;
      soundManager.stopBaseSiren();
      soundManager.playHackSound();
      const obj = this.objectives.find((o) => o.id === 'obj_alarm');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    } else if (nearestItem.type === 'generator') {
      nearestItem.isCollected = true;
      this.baseAlarmActive = false;
      soundManager.playGeneratorSabotage();
      const obj = this.objectives.find((o) => o.id === 'obj_generator');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    } else if (nearestItem.type === 'radar_hack') {
      nearestItem.isCollected = true;
      soundManager.playHackSound();
      const obj = this.objectives.find((o) => o.id === 'obj_radar_hack');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    } else if (nearestItem.type === 'silo_override') {
      nearestItem.isCollected = true;
      soundManager.playHackSound();
      const obj = this.objectives.find((o) => o.id === 'obj_silo_override');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    } else if (nearestItem.type === 'bunker_power') {
      nearestItem.isCollected = true;
      soundManager.playGeneratorSabotage();
      const obj = this.objectives.find((o) => o.id === 'obj_bunker_breach');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    } else if (nearestItem.type === 'extraction') {
      const primaryDone = this.objectives
        .filter((o) => !o.isOptional && o.id !== 'obj_extract')
        .every((o) => o.isCompleted);
      if (!primaryDone) {
        soundManager.playDryFire();
        this.currentPrompt = 'HQ ADVISORY: CANNOT EXTRACT // PRIMARY OBJECTIVES STILL PENDING!';
      }
    }
  }

  // =========================================================================
  // SUB-STEPPED RIGID PLAYER PHYSICS: PREVENTS PASSING THROUGH OBJECTS
  // =========================================================================

  private updatePlayerPhysics(dt: number) {
    // 1. Posture & Eye Level
    this.targetEyeHeight = this.isCrouching ? 0.9 : 1.7;
    this.eyeHeight += (this.targetEyeHeight - this.eyeHeight) * 12 * dt;

    // 2. Sprinting & Stamina
    const wantsSprint =
      this.keys['ShiftLeft'] &&
      !this.isCrouching &&
      (this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD']);
    if (wantsSprint && this.stamina > 5) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - 28 * dt);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(100, this.stamina + 18 * dt);
    }

    // 3. Leaning (Q / E)
    this.targetLean = 0;
    if (this.keys['KeyQ']) this.targetLean -= 1;
    if (this.keys['KeyE']) this.targetLean += 1;
    this.currentLean += (this.targetLean - this.currentLean) * 10 * dt;
    this.actualLeanOffset = this.currentLean * 0.38;

    // 4. Input Direction
    const moveSpeed = this.isCrouching ? 2.8 : this.isSprinting ? 9.2 : 5.4;
    const moveDir = new THREE.Vector3();

    if (this.keys['KeyW']) moveDir.z -= 1;
    if (this.keys['KeyS']) moveDir.z += 1;
    if (this.keys['KeyA']) moveDir.x -= 1;
    if (this.keys['KeyD']) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

      this.playerVel.x = moveDir.x * moveSpeed;
      this.playerVel.z = moveDir.z * moveSpeed;

      // Footstep audio
      this.footstepTimer += dt * (this.isSprinting ? 14 : 7);
      if (this.footstepTimer > Math.PI) {
        this.footstepTimer = 0;
        soundManager.playFootstep(this.isSprinting, this.isCrouching);
        if (this.isSprinting) {
          this.alertEnemiesBySound(this.playerPos, 18);
        }
      }

      if (this.settings.headBobbing) {
        this.bobTimer += dt * (this.isSprinting ? 12 : 7) * this.settings.bobIntensity;
      }
    } else {
      this.playerVel.x *= 0.65;
      this.playerVel.z *= 0.65;
    }

    // Gravity & Jump
    if (this.isGrounded && this.keys['Space'] && !this.isCrouching) {
      this.playerVel.y = 5.6;
      this.isGrounded = false;
    }
    if (!this.isGrounded) {
      this.playerVel.y -= 16.0 * dt;
    }

    // 5. CONTINUOUS SUB-STEPPED AXIS-SEPARATED COLLISION RESOLUTION
    const playerRadius = 0.45;
    const playerHeight = this.eyeHeight;

    // Substepping prevents tunneling even at sprint speeds
    const totalDistSq = (this.playerVel.x * dt) ** 2 + (this.playerVel.z * dt) ** 2;
    const subSteps = totalDistSq > 0.04 ? 2 : 1;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      // Step X
      const dx = this.playerVel.x * subDt;
      const testPosX = this.playerPos.x + dx;

      let blockedX = false;
      const footY = this.playerPos.y - playerHeight;
      const headY = this.playerPos.y + 0.15;

      for (const box of this.mapData.colliders) {
        // Vertical overlap check
        if (headY >= box.min.y && footY <= box.max.y) {
          // Z axis overlap check
          if (this.playerPos.z + playerRadius > box.min.z && this.playerPos.z - playerRadius < box.max.z) {
            // X axis test
            if (testPosX + playerRadius > box.min.x && testPosX - playerRadius < box.max.x) {
              if (dx > 0) {
                this.playerPos.x = box.min.x - playerRadius - 0.001;
              } else if (dx < 0) {
                this.playerPos.x = box.max.x + playerRadius + 0.001;
              }
              this.playerVel.x = 0;
              blockedX = true;
              break;
            }
          }
        }
      }
      if (!blockedX) {
        this.playerPos.x = testPosX;
      }

      // Step Z
      const dz = this.playerVel.z * subDt;
      const testPosZ = this.playerPos.z + dz;

      let blockedZ = false;
      for (const box of this.mapData.colliders) {
        if (headY >= box.min.y && footY <= box.max.y) {
          if (this.playerPos.x + playerRadius > box.min.x && this.playerPos.x - playerRadius < box.max.x) {
            if (testPosZ + playerRadius > box.min.z && testPosZ - playerRadius < box.max.z) {
              if (dz > 0) {
                this.playerPos.z = box.min.z - playerRadius - 0.001;
              } else if (dz < 0) {
                this.playerPos.z = box.max.z + playerRadius + 0.001;
              }
              this.playerVel.z = 0;
              blockedZ = true;
              break;
            }
          }
        }
      }
      if (!blockedZ) {
        this.playerPos.z = testPosZ;
      }
    }

    // Step Y (Gravity & Standing on Platforms/Crates)
    this.playerPos.y += this.playerVel.y * dt;

    let highestGround = this.eyeHeight;
    const testFootY = this.playerPos.y - playerHeight;

    for (const box of this.mapData.colliders) {
      if (
        this.playerPos.x >= box.min.x - 0.2 &&
        this.playerPos.x <= box.max.x + 0.2 &&
        this.playerPos.z >= box.min.z - 0.2 &&
        this.playerPos.z <= box.max.z + 0.2
      ) {
        // Can stand on top of this surface
        if (testFootY <= box.max.y && testFootY >= box.max.y - 0.6) {
          highestGround = Math.max(highestGround, box.max.y + playerHeight);
        }
      }
    }

    if (this.playerPos.y <= highestGround) {
      this.playerPos.y = highestGround;
      this.playerVel.y = 0;
      this.isGrounded = true;
    }

    // Clamp compound outer boundaries
    this.playerPos.x = Math.max(-70, Math.min(70, this.playerPos.x));
    this.playerPos.z = Math.max(-70, Math.min(70, this.playerPos.z));

    // Update Camera Transform
    const leanVec = new THREE.Vector3(this.actualLeanOffset, 0, 0);
    leanVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const bobY = Math.sin(this.bobTimer) * 0.04;
    const bobX = Math.cos(this.bobTimer * 0.5) * 0.02;

    this.camera.position.set(
      this.playerPos.x + leanVec.x + bobX,
      this.playerPos.y + bobY,
      this.playerPos.z + leanVec.z
    );

    const cameraRot = new THREE.Euler(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(cameraRot);

    // Recoil recovery
    this.recoilPitch *= Math.pow(0.001, dt);
    this.recoilYaw *= Math.pow(0.001, dt);

    // Check interaction prompt
    this.updateInteractionPrompt();

    // Night vision battery drain
    if (this.isNightVision) {
      this.nvgBattery = Math.max(0, this.nvgBattery - 2.5 * dt);
      if (this.nvgBattery <= 0) {
        this.toggleNightVision();
      }
    } else {
      this.nvgBattery = Math.min(100, this.nvgBattery + 5 * dt);
    }
  }

  private updateInteractionPrompt() {
    let nearestPrompt: string | null = null;
    let minDist = 3.2;

    for (const item of this.mapData.interactiveItems) {
      if (item.isCollected) continue;
      const d = this.playerPos.distanceTo(item.position);
      if (d < minDist) {
        minDist = d;
        if (item.type === 'ammo') nearestPrompt = 'PRESS [F] / [E] TO COLLECT AMMUNITION';
        else if (item.type === 'medkit') nearestPrompt = 'PRESS [F] / [E] TO USE COMBAT MEDKIT';
        else if (item.type === 'briefcase') nearestPrompt = 'PRESS [F] / [E] TO SECURE CLASSIFIED BRIEFCASE';
        else if (item.type === 'alarm_console') nearestPrompt = 'PRESS [F] / [E] TO HACK SECURITY SIREN TERMINAL';
        else if (item.type === 'generator') nearestPrompt = 'PRESS [F] / [E] TO SABOTAGE POWER TURBINE GRID';
        else if (item.type === 'radar_hack') nearestPrompt = 'PRESS [F] / [E] TO UPLOAD TELEMETRY OVERRIDE';
        else if (item.type === 'silo_override') nearestPrompt = 'PRESS [F] / [E] TO ABORT STRATEGIC MISSILE LAUNCH';
        else if (item.type === 'bunker_power') nearestPrompt = 'PRESS [F] / [E] TO DISABLE BACKUP DIESEL DYNAMO';
        else if (item.type === 'extraction') {
          const primaryDone = this.objectives
            .filter((o) => !o.isOptional && o.id !== 'obj_extract')
            .every((o) => o.isCompleted);
          if (this.isExtracting) {
            nearestPrompt = 'EXFILTRATION IN PROGRESS // RETURNING TO HQ...';
          } else if (primaryDone) {
            if (this.extractHoldTimer > 0) {
              const remaining = Math.max(0, 1.5 - this.extractHoldTimer).toFixed(1);
              nearestPrompt = `CONFIRMING EXFILTRATION... [HOLD F / E] (${remaining}s)`;
            } else {
              nearestPrompt = 'HOLD [F] OR [E] (1.5s) TO BOARD EXTRACTION TRANSPORT';
            }
          } else {
            nearestPrompt = 'EXTRACTION LOCKED // PRIMARY DIRECTIVES INCOMPLETE';
          }
        }
      }
    }

    this.currentPrompt = nearestPrompt;
  }

  // =========================================================================
  // ENEMY AI: STEALTH PERCEPTION & SIGHTLINES (NO VISION/GUNFIRE THROUGH WALLS)
  // =========================================================================

  private updateEnemies(dt: number) {
    let anyInCombat = false;
    const isDaylight = this.missionDef.environment === 'daylight_radar';

    for (const enemy of this.enemies) {
      if (enemy.isDead) {
        if (enemy.deathAnimTime < 1.0) {
          enemy.deathAnimTime += dt * 3;
          enemy.mesh.rotation.x = Math.min(Math.PI / 2, enemy.mesh.rotation.x + dt * 4);
          enemy.mesh.position.y = Math.max(0.15, enemy.mesh.position.y - dt * 2);
        }
        continue;
      }

      const eData = enemy.data;
      const ePos = enemy.mesh.position;
      const distToPlayer = ePos.distanceTo(this.playerPos);

      // Vision line of sight ray
      const eyePos = ePos.clone().add(new THREE.Vector3(0, 1.6, 0));
      const toPlayer = this.playerPos.clone().sub(eyePos);
      const dist = toPlayer.length();
      toPlayer.normalize();

      const guardDir = new THREE.Vector3(0, 0, 1).applyEuler(enemy.mesh.rotation);
      const dot = guardDir.dot(toPlayer);

      // In Daylight: 50% wider sight detection range
      const baseRange = eData.role === 'sniper' ? 80 : 36;
      const sightRange = isDaylight ? baseRange * 1.4 : baseRange;
      const fovThreshold = eData.role === 'sniper' ? 0.12 : isDaylight ? 0.25 : 0.35;

      let canSeePlayer = false;
      if (dist < sightRange && (dot > fovThreshold || dist < 3.2)) {
        const losRay = new THREE.Raycaster(eyePos, toPlayer, 0.4, dist);
        let blocked = false;

        // Verify occlusion against all physical barriers
        for (const box of this.mapData.colliders) {
          const hit = new THREE.Vector3();
          if (losRay.ray.intersectBox(box, hit)) {
            if (hit.distanceTo(eyePos) < dist - 0.5) {
              blocked = true;
              break;
            }
          }
        }

        if (!blocked) {
          canSeePlayer = true;
        }
      }

      if (canSeePlayer) {
        let rate = isDaylight ? 80 : 60;
        if (this.isCrouching) rate *= 0.45;
        if (dist > 25) rate *= 0.5;

        eData.suspicionMeter = Math.min(100, eData.suspicionMeter + rate * dt);
        eData.lastKnownPlayerPos = [this.playerPos.x, this.playerPos.y, this.playerPos.z];

        if (eData.suspicionMeter >= 100) {
          if (eData.alertState !== 'combat') {
            soundManager.playGuardVoice('spotted');
          }
          eData.alertState = 'combat';
        } else if (eData.suspicionMeter > 30) {
          if (eData.alertState === 'idle') {
            soundManager.playGuardVoice('investigate');
          }
          eData.alertState = 'suspicious';
        }
      } else {
        if (eData.alertState !== 'combat') {
          eData.suspicionMeter = Math.max(0, eData.suspicionMeter - 20 * dt);
          if (eData.suspicionMeter === 0) eData.alertState = 'idle';
        }
      }

      EnemyMeshFactory.updateVisorColor(enemy.visorMat, eData.alertState);

      // State Machine Actions
      if (eData.alertState === 'combat') {
        anyInCombat = true;
        const angleToPlayer = Math.atan2(this.playerPos.x - ePos.x, this.playerPos.z - ePos.z);
        enemy.mesh.rotation.y = angleToPlayer;

        eData.shootCooldown -= dt;
        if (eData.shootCooldown <= 0 && distToPlayer < (eData.role === 'sniper' ? 85 : 45)) {
          this.enemyShootAtPlayer(enemy);
          eData.shootCooldown = eData.role === 'sniper' ? 2.2 : 0.18 + Math.random() * 0.2;
        }

        if (eData.role === 'patrol' && distToPlayer > 12) {
          const step = toPlayer.clone().multiplyScalar(3.8 * dt);
          ePos.x += step.x;
          ePos.z += step.z;
          this.animateEnemyLegs(enemy, dt, 3.8);
        }
      } else if (eData.alertState === 'investigating' || eData.alertState === 'suspicious') {
        if (eData.lastKnownPlayerPos) {
          const target = new THREE.Vector3(...eData.lastKnownPlayerPos);
          const toTarget = target.clone().sub(ePos);
          toTarget.y = 0;
          if (toTarget.length() > 2) {
            toTarget.normalize();
            enemy.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
            ePos.add(toTarget.multiplyScalar(2.2 * dt));
            this.animateEnemyLegs(enemy, dt, 2.2);
          }
        }
      } else {
        if (eData.patrolPoints.length > 1) {
          const curTarget = eData.patrolPoints[eData.currentPatrolIdx];
          const targetVec = new THREE.Vector3(curTarget[0], ePos.y, curTarget[2]);
          const toPt = targetVec.clone().sub(ePos);
          if (toPt.length() < 1.0) {
            eData.currentPatrolIdx = (eData.currentPatrolIdx + 1) % eData.patrolPoints.length;
          } else {
            toPt.normalize();
            enemy.mesh.rotation.y = Math.atan2(toPt.x, toPt.z);
            ePos.add(toPt.multiplyScalar(1.6 * dt));
            this.animateEnemyLegs(enemy, dt, 1.6);
          }
        }
      }
    }

    if (anyInCombat && !this.baseAlarmActive) {
      this.alarmTriggerTime += dt;
      if (this.alarmTriggerTime > 3.8) {
        this.triggerBaseAlarm();
      }
    }
  }

  private animateEnemyLegs(enemy: EnemyEntry, dt: number, speed: number) {
    enemy.walkCycle += dt * speed * 4;
    const legSwing = Math.sin(enemy.walkCycle) * 0.45;
    enemy.leftLeg.rotation.x = legSwing;
    enemy.rightLeg.rotation.x = -legSwing;
  }

  private enemyShootAtPlayer(enemy: EnemyEntry) {
    const isSniper = enemy.data.role === 'sniper';
    const accuracy = isSniper ? 0.75 : 0.45;

    // Line of sight check for gunfire (guards cannot shoot through walls)
    const gunMuzzle = enemy.mesh.position.clone().add(new THREE.Vector3(0.12, 1.1, 0.4));
    const toPlayer = this.playerPos.clone().sub(gunMuzzle);
    const dist = toPlayer.length();
    toPlayer.normalize();

    const checkRay = new THREE.Raycaster(gunMuzzle, toPlayer, 0.4, dist);
    let obstructed = false;
    for (const box of this.mapData.colliders) {
      const hit = new THREE.Vector3();
      if (checkRay.ray.intersectBox(box, hit)) {
        if (hit.distanceTo(gunMuzzle) < dist - 0.4) {
          obstructed = true;
          break;
        }
      }
    }

    if (obstructed) return;

    if (isSniper) soundManager.playSniperShot();
    else soundManager.playAk74mShot();

    if (Math.random() < accuracy) {
      const dmg = isSniper ? 35 : 12;
      this.damagePlayer(dmg, enemy.mesh.position);
    }

    this.createBulletTracer(
      gunMuzzle,
      this.camera.position.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)
      )
    );
  }

  private damagePlayer(amount: number, sourcePos: THREE.Vector3) {
    if (this.armor > 0) {
      const armorDmg = Math.min(this.armor, amount * 0.65);
      this.armor -= armorDmg;
      this.health -= amount - armorDmg;
    } else {
      this.health -= amount;
    }

    const toSource = sourcePos.clone().sub(this.playerPos);
    const angleToSource = Math.atan2(toSource.x, -toSource.z);
    const relativeAngle = ((angleToSource - this.yaw) * 180) / Math.PI;
    this.damageDirection = (relativeAngle + 360) % 360;
    this.damageDirectionTimer = 0.8;

    soundManager.playFleshHit();
    soundManager.updateLowHealthHeartbeat(this.health < 30);

    if (this.health <= 0) {
      this.health = 0;
      this.endMission(false);
    }
  }

  private killEnemy(enemy: EnemyEntry) {
    enemy.isDead = true;
    enemy.data.alertState = 'dead';
    this.stats.kills++;
    soundManager.playGuardVoice('death');
    EnemyMeshFactory.updateVisorColor(enemy.visorMat, 'dead');

    // Check specific target objectives
    if (enemy.data.id === 'guard_officer') {
      const obj = this.objectives.find((o) => o.id === 'obj_officer');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    }
    if (enemy.data.id === 'guard_commander') {
      const obj = this.objectives.find((o) => o.id === 'obj_commander');
      if (obj) obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    }

    const snipersAlive = this.enemies.filter((e) => e.data.role === 'sniper' && !e.isDead).length;
    if (snipersAlive === 0) {
      const obj = this.objectives.find((o) => o.id === 'obj_snipers');
      if (obj) obj.isCompleted = true;
    }
  }

  private alertEnemiesBySound(origin: THREE.Vector3, radius: number) {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const d = enemy.mesh.position.distanceTo(origin);
      if (d < radius && enemy.data.alertState === 'idle') {
        enemy.data.alertState = 'suspicious';
        enemy.data.suspicionMeter = 60;
        enemy.data.lastKnownPlayerPos = [origin.x, origin.y, origin.z];
        EnemyMeshFactory.updateVisorColor(enemy.visorMat, 'suspicious');
        soundManager.playGuardVoice('investigate');
      }
    }
  }

  private triggerBaseAlarm() {
    this.baseAlarmActive = true;
    this.stats.alarms++;
    soundManager.startBaseSiren();

    for (const enemy of this.enemies) {
      if (!enemy.isDead && enemy.data.alertState !== 'combat') {
        enemy.data.alertState = 'investigating';
        enemy.data.suspicionMeter = 90;
        enemy.data.lastKnownPlayerPos = [this.playerPos.x, this.playerPos.y, this.playerPos.z];
        EnemyMeshFactory.updateVisorColor(enemy.visorMat, 'investigating');
      }
    }
  }

  private explodeBarrel(barrel: ExplosiveBarrel) {
    barrel.isExploded = true;
    this.scene.remove(barrel.mesh);
    soundManager.playExplosion();

    this.createExplosionVFX(barrel.position);

    // Damage player if close
    const distToPlayer = this.playerPos.distanceTo(barrel.position);
    if (distToPlayer < 9) {
      this.damagePlayer((1 - distToPlayer / 9) * 80, barrel.position);
    }

    // Damage enemies
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const d = enemy.mesh.position.distanceTo(barrel.position);
      if (d < 10) {
        enemy.data.health -= (1 - d / 10) * 120;
        if (enemy.data.health <= 0) {
          this.killEnemy(enemy);
        }
      }
    }

    this.alertEnemiesBySound(barrel.position, 60);
  }

  private createExplosionVFX(pos: THREE.Vector3) {
    const flash = new THREE.PointLight(0xf97316, 6, 25);
    flash.position.copy(pos);
    this.scene.add(flash);
    setTimeout(() => {
      this.scene.remove(flash);
    }, 120);

    const particleCount = 35;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xf97316, size: 0.35 });
    const pSystem = new THREE.Points(geo, mat);
    pSystem.position.copy(pos);
    this.scene.add(pSystem);
    setTimeout(() => {
      this.scene.remove(pSystem);
    }, 450);
  }

  private createHitSparks(pos: THREE.Vector3) {
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(15 * 3);
    for (let i = 0; i < 15 * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 0.5;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xfef08a, size: 0.08 });
    const p = new THREE.Points(pGeo, pMat);
    p.position.copy(pos);
    this.scene.add(p);
    setTimeout(() => this.scene.remove(p), 120);
  }

  private createBloodParticles(pos: THREE.Vector3) {
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(20 * 3);
    for (let i = 0; i < 20 * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 0.4;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x991b1b, size: 0.1 });
    const p = new THREE.Points(pGeo, pMat);
    p.position.copy(pos);
    this.scene.add(p);
    setTimeout(() => this.scene.remove(p), 200);
  }

  private createBulletTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const mat = new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.8 });
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTracers.push({ line, age: 0 });
  }

  private updateTracers(dt: number) {
    for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
      const t = this.bulletTracers[i];
      t.age += dt;
      if (t.age > 0.08) {
        this.scene.remove(t.line);
        this.bulletTracers.splice(i, 1);
      }
    }
  }

  private updateSurveillanceCameras(dt: number) {
    for (const cam of this.mapData.cameras) {
      if (cam.isDestroyed) continue;
      const angle = cam.baseAngle + Math.sin(Date.now() * 0.001) * (cam.sweepRange / 2);
      cam.head.rotation.y = angle;

      if (!this.baseAlarmActive) {
        const camPos = cam.mount.position;
        const d = camPos.distanceTo(this.playerPos);
        if (d < 18) {
          const toPlayer = this.playerPos.clone().sub(camPos).normalize();
          const camForward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, angle, 0));
          if (camForward.dot(toPlayer) > 0.7) {
            this.triggerBaseAlarm();
          }
        }
      }
    }
  }

  private updateSpotlights(dt: number) {
    for (const spot of this.mapData.spotlights) {
      spot.baseAngle += dt * spot.sweepSpeed;
      const radius = 22;
      spot.target.position.x = spot.light.position.x + Math.cos(spot.baseAngle) * radius;
      spot.target.position.z = spot.light.position.z + Math.sin(spot.baseAngle) * radius;

      if (!this.baseAlarmActive) {
        const d = this.playerPos.distanceTo(spot.target.position);
        if (d < 4.5 && this.playerPos.y < 3) {
          this.triggerBaseAlarm();
        }
      }
    }
  }

  private updateWeaponBobAndPosition() {
    if (!this.currentWeaponMesh) return;

    if (this.isAiming) {
      // ADS positioning
      this.currentWeaponMesh.position.set(0, -0.14, -0.32);
    } else {
      const bobX = Math.cos(this.bobTimer * 0.5) * 0.012;
      const bobY = Math.abs(Math.sin(this.bobTimer)) * 0.015;
      this.currentWeaponMesh.position.set(0.18 + bobX, -0.22 - bobY, -0.42);
    }
  }

  private startLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.08);

      // Timers
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.hitMarkerTimer > 0) this.hitMarkerTimer -= dt;
      if (this.damageDirectionTimer > 0) {
        this.damageDirectionTimer -= dt;
        if (this.damageDirectionTimer <= 0) this.damageDirection = null;
      }

      // Reloading
      if (this.isReloading) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          this.isReloading = false;
          const cur = this.weapons[this.currentWeaponIdx];
          const needed = cur.magSize - cur.ammo;
          const loaded = Math.min(needed, cur.reserve);
          cur.ammo += loaded;
          cur.reserve -= loaded;
        }
      }

      // Auto Fire
      if (this.isMouseDown && this.weapons[this.currentWeaponIdx].isAutomatic) {
        this.triggerFire();
      }

      // Hold-to-Exfiltrate Logic
      if (!this.isExtracting) {
        const extractZone = this.mapData.interactiveItems.find((i) => i.type === 'extraction');
        if (extractZone && this.playerPos.distanceTo(extractZone.position) < 3.8) {
          const primaryDone = this.objectives
            .filter((o) => !o.isOptional && o.id !== 'obj_extract')
            .every((o) => o.isCompleted);

          if (primaryDone && (this.keys['KeyF'] || this.keys['KeyE'])) {
            this.extractHoldTimer += dt;
            if (this.extractHoldTimer >= 1.5) {
              this.isExtracting = true;
              soundManager.playHelicopterExtraction();
              soundManager.playObjectiveCompleted();
              const obj = this.objectives.find((o) => o.id === 'obj_extract');
              if (obj) obj.isCompleted = true;
              this.currentPrompt = 'EXFILTRATION CONFIRMED // RETURNING TO BASE...';
              setTimeout(() => {
                this.endMission(true);
              }, 1200);
            }
          } else {
            this.extractHoldTimer = 0;
          }
        } else {
          this.extractHoldTimer = 0;
        }
      }

      // Physics & Simulation
      this.updatePlayerPhysics(dt);
      this.updateEnemies(dt);
      this.updateSurveillanceCameras(dt);
      this.updateSpotlights(dt);
      this.updateTracers(dt);
      this.updateWeaponBobAndPosition();

      // Binoculars target tracking
      if (this.isBinoculars) {
        this.updateBinocularsTarget();
      }

      // Render
      this.renderer.render(this.scene, this.camera);

      // HUD Callback
      this.dispatchHudUpdate();
    };
    loop();
  }

  private updateBinocularsTarget() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    let nearestEnemy: EnemyData | null = null;
    let minDist = 300;

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const d = raycaster.ray.distanceToPoint(enemy.mesh.position);
      const distFromPlayer = this.camera.position.distanceTo(enemy.mesh.position);
      if (d < 1.4 && distFromPlayer < minDist) {
        minDist = distFromPlayer;
        nearestEnemy = enemy.data;
      }
    }

    this.targetedEnemy = nearestEnemy;
    this.targetDistance = nearestEnemy ? Math.round(minDist) : null;
  }

  private dispatchHudUpdate() {
    let heading = ((-this.yaw * 180) / Math.PI) % 360;
    if (heading < 0) heading += 360;

    let highestSuspicion = 0;
    for (const e of this.enemies) {
      if (!e.isDead && e.data.suspicionMeter > highestSuspicion) {
        highestSuspicion = e.data.suspicionMeter;
      }
    }

    this.callbacks.onHudUpdate({
      health: Math.round(this.health),
      armor: Math.round(this.armor),
      stamina: Math.round(this.stamina),
      currentWeapon: this.weapons[this.currentWeaponIdx],
      weapons: this.weapons,
      stealthVisibility: Math.round(highestSuspicion),
      stealthNoise: this.isSprinting ? 80 : this.isCrouching ? 10 : 35,
      compassHeading: Math.round(heading),
      isAiming: this.isAiming,
      isReloading: this.isReloading,
      hitMarker: this.hitMarkerTimer > 0,
      damageDirection: this.damageDirection,
      baseAlarmActive: this.baseAlarmActive,
      objectives: this.objectives,
      interactionPrompt: this.currentPrompt,
      enemies: this.enemies.map((e) => e.data),
      leanOffset: this.actualLeanOffset,
      isNightVision: this.isNightVision,
      isBinoculars: this.isBinoculars,
      nvgBattery: Math.round(this.nvgBattery),
      targetDistance: this.targetDistance,
      targetedEnemy: this.targetedEnemy,
    });
  }

  public endMission(victory: boolean) {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    soundManager.stopBaseSiren();

    const elapsed = Math.round((Date.now() - this.stats.startTime) / 1000);
    const accuracy =
      this.stats.shotsFired > 0 ? Math.round((this.stats.shotsHit / this.stats.shotsFired) * 100) : 100;

    this.callbacks.onMissionEnd(victory, {
      kills: this.stats.kills,
      headshots: this.stats.headshots,
      time: elapsed,
      shotsFired: this.stats.shotsFired,
      accuracy,
      alarms: this.stats.alarms,
    });
  }

  public getPlayerPosition(): [number, number, number] {
    return [this.playerPos.x, this.playerPos.y, this.playerPos.z];
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    soundManager.stopBaseSiren();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
