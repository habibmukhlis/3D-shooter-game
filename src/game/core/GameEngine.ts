import * as THREE from 'three';
import { soundManager } from '../../audio/SoundManager';
import {
  CAMPAIGN_MISSIONS,
  GameSettings,
  MissionId,
} from '../../types/game';
import { MapBuilder } from '../MapBuilder';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { EventBus } from './EventBus';
import { GameContext, GameEngineCallbacks } from './GameContext';
import { InputSystem } from '../systems/InputSystem';
import { WorldSystem } from '../systems/WorldSystem';
import { VFXSystem } from '../systems/VFXSystem';
import { PlayerController } from '../systems/PlayerController';
import { WeaponSystem } from '../systems/WeaponSystem';
import { AISystem } from '../systems/AISystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { ObjectiveSystem } from '../systems/ObjectiveSystem';
import { HudBridge } from '../systems/HudBridge';

export class GameEngine {
  private container: HTMLElement;
  private ctx: GameContext;
  private clock: THREE.Clock;
  private animFrameId: number | null = null;
  private cleanupResize: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    callbacks: GameEngineCallbacks,
    initialSettings: GameSettings,
    missionId: MissionId = 'mission_01'
  ) {
    this.container = container;

    const missionDef = CAMPAIGN_MISSIONS.find((m) => m.id === missionId) || CAMPAIGN_MISSIONS[0];

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      initialSettings.fieldOfView,
      window.innerWidth / window.innerHeight,
      0.1,
      350
    );

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(renderer.domElement);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    this.cleanupResize = () => window.removeEventListener('resize', handleResize);

    // 3. EventBus & Context
    const events = new EventBus();
    this.ctx = new GameContext({
      scene,
      camera,
      renderer,
      settings: initialSettings,
      missionId,
      missionDef,
      callbacks,
      events,
    });

    // 4. Map & Physics World Setup
    this.ctx.mapData = MapBuilder.buildCompound(scene, missionId);
    this.ctx.physics = new PhysicsWorld(4);
    for (const box of this.ctx.mapData.colliders) {
      this.ctx.physics.add(box, 'generic', undefined, box);
    }

    // 5. Initialize Subsystems
    const systems: any = {};
    this.ctx.systems = systems;

    systems.input = new InputSystem(this.ctx);
    systems.world = new WorldSystem(this.ctx);
    systems.vfx = new VFXSystem(this.ctx);
    systems.player = new PlayerController(this.ctx);
    systems.weapons = new WeaponSystem(this.ctx);
    systems.ai = new AISystem(this.ctx);
    systems.interaction = new InteractionSystem(this.ctx);
    systems.objectives = new ObjectiveSystem(this.ctx);
    systems.hud = new HudBridge(this.ctx);

    // 6. Sound volumes
    soundManager.setVolumes(
      initialSettings.masterVolume,
      initialSettings.sfxVolume,
      initialSettings.ambientVolume
    );

    // 7. Start Render & Simulation Loop
    this.clock = new THREE.Clock();
    this.startLoop();
  }

  public getContext(): GameContext {
    return this.ctx;
  }

  public updateSettings(newSettings: GameSettings) {
    this.ctx.settings = newSettings;
    this.ctx.systems.hud.updateCameraFov();
    this.ctx.systems.world.applyShadowSettings();
    soundManager.setVolumes(newSettings.masterVolume, newSettings.sfxVolume, newSettings.ambientVolume);
  }

  public toggleNightVision() {
    this.ctx.systems.player.toggleNightVision();
  }

  public toggleBinoculars() {
    this.ctx.systems.hud.toggleBinoculars();
  }

  public tagCurrentTarget() {
    this.ctx.systems.hud.tagCurrentTarget();
  }

  public getPlayerPosition(): [number, number, number] {
    return [this.ctx.player.pos.x, this.ctx.player.pos.y, this.ctx.player.pos.z];
  }

  public endMission(victory: boolean) {
    this.ctx.systems.objectives.endMission(victory);
  }

  private startLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.08);

      if (!this.ctx.isPaused && !this.ctx.hasEnded) {
        this.ctx.time += dt;

        // Core systems update in defined order
        this.ctx.systems.input.update();
        this.ctx.systems.player.update(dt);
        this.ctx.systems.weapons.update(dt);
        this.ctx.systems.ai.update(dt);
        this.ctx.systems.world.update(dt);
        this.ctx.systems.vfx.update(dt);
        this.ctx.systems.interaction.update(dt);
        this.ctx.systems.objectives.update();
        this.ctx.systems.hud.update(dt);
      }

      this.ctx.renderer.render(this.ctx.scene, this.ctx.camera);
    };

    loop();
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.cleanupResize) {
      this.cleanupResize();
      this.cleanupResize = null;
    }

    soundManager.stopBaseSiren();

    this.ctx.systems.input.dispose();
    this.ctx.systems.weapons.dispose();
    this.ctx.systems.vfx.dispose();
    this.ctx.systems.world.dispose?.();
    this.ctx.events.clear();

    if (this.ctx.renderer.domElement.parentElement) {
      this.ctx.renderer.domElement.parentElement.removeChild(this.ctx.renderer.domElement);
    }
    this.ctx.renderer.dispose();
  }
}
