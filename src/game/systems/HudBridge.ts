import * as THREE from 'three';
import { soundManager } from '../../audio/SoundManager';
import type { EnemyData } from '../../types/game';
import type { GameContext, GameSystem } from '../core/GameContext';

export class HudBridge implements GameSystem {
  private ctx: GameContext;
  private targetedEnemy: EnemyData | null = null;
  private targetDistance: number | null = null;
  private throttleTimer = 0;
  private frameCount = 0;
  private fpsAccum = 0;

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    ctx.systems.input.onAction((action) => {
      if (action === 'binoculars') {
        this.toggleBinoculars();
      } else if (action === 'firePress' && ctx.player.isBinoculars) {
        this.tagCurrentTarget();
      }
    });
  }

  public toggleBinoculars() {
    const p = this.ctx.player;
    p.isBinoculars = !p.isBinoculars;
    p.isAiming = false;
    soundManager.playBinocularsZoom();

    this.updateCameraFov();
  }

  public tagCurrentTarget() {
    if (this.targetedEnemy) {
      this.targetedEnemy.isTagged = true;
      soundManager.playHitMarker();
    }
  }

  public updateCameraFov() {
    const p = this.ctx.player;
    const curWep = this.ctx.systems.weapons.currentWeapon;
    this.ctx.camera.fov = p.isAiming
      ? curWep.zoomFov
      : p.isBinoculars
      ? 12
      : this.ctx.settings.fieldOfView;
    this.ctx.camera.updateProjectionMatrix();
  }

  public update(dt: number) {
    this.frameCount++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.5) {
      this.ctx.fps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    if (this.ctx.player.isBinoculars) {
      this.updateBinocularsTarget();
    }

    this.throttleTimer += dt;
    if (this.throttleTimer >= 0.05) {
      this.throttleTimer = 0;
      this.dispatch();
    }
  }

  private updateBinocularsTarget() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.ctx.camera);

    let nearestEnemy: EnemyData | null = null;
    let minDist = 300;

    for (const enemy of this.ctx.enemies) {
      if (enemy.isDead) continue;
      const d = raycaster.ray.distanceToPoint(enemy.mesh.position);
      const distFromPlayer = this.ctx.camera.position.distanceTo(enemy.mesh.position);
      if (d < 1.4 && distFromPlayer < minDist) {
        minDist = distFromPlayer;
        nearestEnemy = enemy.data;
      }
    }

    this.targetedEnemy = nearestEnemy;
    this.targetDistance = nearestEnemy ? Math.round(minDist) : null;
  }

  public dispatch() {
    const p = this.ctx.player;
    let heading = ((-p.yaw * 180) / Math.PI) % 360;
    if (heading < 0) heading += 360;

    let highestSuspicion = 0;
    for (const e of this.ctx.enemies) {
      if (!e.isDead && e.data.suspicionMeter > highestSuspicion) {
        highestSuspicion = e.data.suspicionMeter;
      }
    }

    this.ctx.callbacks.onHudUpdate({
      health: Math.round(p.health),
      armor: Math.round(p.armor),
      stamina: Math.round(p.stamina),
      currentWeapon: this.ctx.systems.weapons.currentWeapon,
      weapons: this.ctx.systems.weapons.weapons,
      stealthVisibility: Math.round(highestSuspicion),
      stealthNoise: p.isSprinting ? 80 : p.isCrouching ? 10 : 35,
      compassHeading: Math.round(heading),
      isAiming: p.isAiming,
      isReloading: this.ctx.systems.weapons.isReloading,
      hitMarker: this.ctx.feedback.hitMarkerTimer > 0,
      isHeadshotHit: this.ctx.feedback.hitMarkerTimer > 0 && this.ctx.feedback.isHeadshotHit,
      damageDirection: this.ctx.feedback.damageDirection,
      baseAlarmActive: this.ctx.alarm.active,
      objectives: this.ctx.objectives,
      interactionPrompt: this.ctx.feedback.prompt,
      enemies: this.ctx.enemies.map((e) => e.data),
      leanOffset: p.actualLeanOffset,
      isNightVision: p.isNightVision,
      isBinoculars: p.isBinoculars,
      nvgBattery: Math.round(p.nvgBattery),
      targetDistance: this.targetDistance,
      targetedEnemy: this.targetedEnemy,
      grenades: p.grenades,
      c4Count: p.c4Count,
      c4Planted: p.c4Planted,
      powerCut: Boolean(this.ctx.mapData?.powerCut),
      fps: this.ctx.fps,
    });
  }
}
