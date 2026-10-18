import * as THREE from 'three';
import { soundManager } from '../../audio/SoundManager';
import type { GameContext, GameSystem } from '../core/GameContext';
import type { ColliderEntry } from '../physics/PhysicsWorld';

const UP = new THREE.Vector3(0, 1, 0);
const PLAYER_RADIUS = 0.45;
const WORLD_BOUND = 70;

/** First-person movement, posture, ladders, collision, camera transform and vitals. */
export class PlayerController implements GameSystem {
  private ctx: GameContext;
  private readonly moveDir = new THREE.Vector3();
  private readonly leanVec = new THREE.Vector3();
  private readonly euler = new THREE.Euler();
  private readonly candidates: ColliderEntry[] = [];

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    ctx.camera.position.copy(ctx.player.pos);

    ctx.systems.input.onAction((a) => {
      if (a === 'crouch') ctx.player.isCrouching = !ctx.player.isCrouching;
      else if (a === 'nightVision') this.toggleNightVision();
    });
  }

  public update(dt: number): void {
    const ctx = this.ctx;
    const p = ctx.player;
    const input = ctx.systems.input.getActions();
    const physics = ctx.physics;

    // 1. Posture & eye level
    p.targetEyeHeight = p.isCrouching ? 0.9 : 1.7;
    p.eyeHeight += (p.targetEyeHeight - p.eyeHeight) * 12 * dt;

    // 2. Sprint & stamina
    const isMoving = input.moveX !== 0 || input.moveY !== 0;
    const wantsSprint = input.sprint && !p.isCrouching && isMoving;
    if (wantsSprint && p.stamina > 5) {
      p.isSprinting = true;
      p.stamina = Math.max(0, p.stamina - 28 * dt);
    } else {
      p.isSprinting = false;
      p.stamina = Math.min(100, p.stamina + 18 * dt);
    }

    // 3. Leaning
    p.targetLean = input.lean;
    p.currentLean += (p.targetLean - p.currentLean) * 10 * dt;
    p.actualLeanOffset = p.currentLean * 0.38;

    // 4. Desired horizontal velocity
    const moveSpeed = p.isCrouching ? 2.8 : p.isSprinting ? 9.2 : 5.4;
    this.moveDir.set(input.moveX, 0, -input.moveY);
    if (this.moveDir.lengthSq() > 0) {
      if (this.moveDir.lengthSq() > 1) this.moveDir.normalize();
      this.moveDir.applyAxisAngle(UP, p.yaw);
      p.vel.x = this.moveDir.x * moveSpeed;
      p.vel.z = this.moveDir.z * moveSpeed;

      p.footstepTimer += dt * (p.isSprinting ? 14 : 7);
      if (p.footstepTimer > Math.PI) {
        p.footstepTimer = 0;
        soundManager.playFootstep(p.isSprinting, p.isCrouching);
        if (p.isSprinting) {
          ctx.events.emit('noise', { origin: p.pos.clone(), radius: 18, kind: 'footstep' });
        }
      }
      if (ctx.settings.headBobbing) {
        p.bobTimer += dt * (p.isSprinting ? 12 : 7) * ctx.settings.bobIntensity;
      }
    } else {
      p.vel.x *= 0.65;
      p.vel.z *= 0.65;
    }

    // 4b. Ladders
    let activeLadderTopY: number | null = null;
    const checkFootY = p.pos.y - p.eyeHeight;
    for (const ladder of ctx.mapData.ladders) {
      const b = ladder.box;
      if (
        p.pos.x >= b.min.x && p.pos.x <= b.max.x &&
        p.pos.z >= b.min.z && p.pos.z <= b.max.z &&
        checkFootY >= b.min.y - 0.5 && checkFootY <= b.max.y
      ) {
        activeLadderTopY = ladder.topY;
        break;
      }
    }

    if (activeLadderTopY !== null) {
      if (input.moveY > 0 || input.jump) {
        p.vel.y = 4.5;
        p.isGrounded = false;
        if (checkFootY >= activeLadderTopY - 0.35) p.vel.z = -3.2;
      } else if (input.moveY < 0) {
        p.vel.y = -4.5;
        p.isGrounded = false;
      } else {
        p.vel.y = 0;
        p.isGrounded = true;
      }
    } else {
      if (p.isGrounded && input.jump && !p.isCrouching) {
        p.vel.y = 5.6;
        p.isGrounded = false;
      }
      if (!p.isGrounded) p.vel.y -= 16.0 * dt;
    }

    // 5. Sub-stepped, axis-separated collision against nearby colliders only
    const playerHeight = p.eyeHeight;
    const travel = Math.hypot(p.vel.x * dt, p.vel.z * dt);
    const reach = PLAYER_RADIUS + travel + 0.6;
    physics.queryArea(p.pos.x - reach, p.pos.z - reach, p.pos.x + reach, p.pos.z + reach, this.candidates);
    const nearby = this.candidates;

    const subSteps = travel * travel > 0.04 ? 2 : 1;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      const footY = p.pos.y - playerHeight;
      const headY = p.pos.y + 0.15;

      const dx = p.vel.x * subDt;
      const testX = p.pos.x + dx;
      let blockedX = false;
      for (const e of nearby) {
        const box = e.box;
        if (headY >= box.min.y && footY <= box.max.y - 0.001 &&
            p.pos.z + PLAYER_RADIUS > box.min.z && p.pos.z - PLAYER_RADIUS < box.max.z &&
            testX + PLAYER_RADIUS > box.min.x && testX - PLAYER_RADIUS < box.max.x) {
          if (dx > 0) p.pos.x = box.min.x - PLAYER_RADIUS - 0.001;
          else if (dx < 0) p.pos.x = box.max.x + PLAYER_RADIUS + 0.001;
          p.vel.x = 0;
          blockedX = true;
          break;
        }
      }
      if (!blockedX) p.pos.x = testX;

      const dz = p.vel.z * subDt;
      const testZ = p.pos.z + dz;
      let blockedZ = false;
      for (const e of nearby) {
        const box = e.box;
        if (headY >= box.min.y && footY <= box.max.y - 0.001 &&
            p.pos.x + PLAYER_RADIUS > box.min.x && p.pos.x - PLAYER_RADIUS < box.max.x &&
            testZ + PLAYER_RADIUS > box.min.z && testZ - PLAYER_RADIUS < box.max.z) {
          if (dz > 0) p.pos.z = box.min.z - PLAYER_RADIUS - 0.001;
          else if (dz < 0) p.pos.z = box.max.z + PLAYER_RADIUS + 0.001;
          p.vel.z = 0;
          blockedZ = true;
          break;
        }
      }
      if (!blockedZ) p.pos.z = testZ;
    }

    // Vertical: gravity and standing on surfaces
    p.pos.y += p.vel.y * dt;
    let highestGround = p.eyeHeight;
    const testFootY = p.pos.y - playerHeight;
    for (const e of nearby) {
      const box = e.box;
      if (p.pos.x >= box.min.x - 0.2 && p.pos.x <= box.max.x + 0.2 &&
          p.pos.z >= box.min.z - 0.2 && p.pos.z <= box.max.z + 0.2) {
        if (testFootY <= box.max.y && testFootY >= box.max.y - 0.6) {
          highestGround = Math.max(highestGround, box.max.y + playerHeight);
        }
      }
    }
    if (p.pos.y <= highestGround) {
      p.pos.y = highestGround;
      p.vel.y = 0;
      p.isGrounded = true;
    } else if (activeLadderTopY === null && p.pos.y > highestGround + 0.05) {
      p.isGrounded = false;
    }

    p.pos.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, p.pos.x));
    p.pos.z = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, p.pos.z));

    // Camera transform
    this.leanVec.set(p.actualLeanOffset, 0, 0).applyAxisAngle(UP, p.yaw);
    const bobY = Math.sin(p.bobTimer) * 0.04;
    const bobX = Math.cos(p.bobTimer * 0.5) * 0.02;
    ctx.camera.position.set(p.pos.x + this.leanVec.x + bobX, p.pos.y + bobY, p.pos.z + this.leanVec.z);
    ctx.camera.quaternion.setFromEuler(ctx.getAimEuler(this.euler));

    // Recoil recovery
    const recover = Math.pow(0.001, dt);
    p.recoilPitch *= recover;
    p.recoilYaw *= recover;

    // NVG battery
    if (p.isNightVision) {
      p.nvgBattery = Math.max(0, p.nvgBattery - 2.5 * dt);
      if (p.nvgBattery <= 0) this.toggleNightVision();
    } else {
      p.nvgBattery = Math.min(100, p.nvgBattery + 5 * dt);
    }
  }

  public toggleNightVision(): void {
    const p = this.ctx.player;
    p.isNightVision = !p.isNightVision;
    soundManager.playNightVisionToggle(p.isNightVision);
    this.ctx.systems.world.applyNightVisionLighting(p.isNightVision);
  }

  public damage(amount: number, sourcePos: THREE.Vector3): void {
    const ctx = this.ctx;
    const p = ctx.player;
    if (ctx.hasEnded) return;
    if (p.armor > 0) {
      const armorDmg = Math.min(p.armor, amount * 0.65);
      p.armor -= armorDmg;
      p.health -= amount - armorDmg;
    } else {
      p.health -= amount;
    }

    const toSource = sourcePos.clone().sub(p.pos);
    const angleToSource = Math.atan2(toSource.x, -toSource.z);
    const relativeAngle = ((angleToSource - p.yaw) * 180) / Math.PI;
    ctx.feedback.damageDirection = (relativeAngle + 360) % 360;
    ctx.feedback.damageDirectionTimer = 0.8;

    soundManager.playFleshHit();
    soundManager.updateLowHealthHeartbeat(p.health < 30);
    ctx.events.emit('playerDamaged', { amount, source: sourcePos });

    if (p.health <= 0) {
      p.health = 0;
      ctx.systems.objectives.endMission(false);
    }
  }

  public heal(health: number, armor: number): void {
    const p = this.ctx.player;
    p.health = Math.min(100, p.health + health);
    p.armor = Math.min(100, p.armor + armor);
    soundManager.updateLowHealthHeartbeat(p.health < 30);
  }
}
