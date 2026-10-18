import * as THREE from 'three';
import { soundManager } from '../../audio/SoundManager';
import type { EnemyData } from '../../types/game';
import { EnemyMeshFactory } from '../EnemyMeshFactory';
import { CoverPoints } from '../ai/CoverPoints';
import { NavGrid } from '../ai/NavGrid';
import type { EnemyEntry, GameContext, GameSystem } from '../core/GameContext';
import { getEnemyRoster } from '../data/enemyRosters';

export interface EnemyTacticalState {
  path: THREE.Vector3[];
  pathIdx: number;
  repathTimer: number;
  coverPos: THREE.Vector3 | null;
  peekTimer: number;
  staggerTimer: number;
  hasCalledRadio: boolean;
  hasRolledCombatTactic: boolean;
  flankSide: number;
  flankTarget: THREE.Vector3 | null;
  searchSweepTimer: number;
  baseScanYaw: number;
  crouchOffset: number;
  pathTarget: THREE.Vector3;
}

export class AISystem implements GameSystem {
  private ctx: GameContext;
  private navGrid: NavGrid;
  private coverPoints: CoverPoints;
  private lastPhysicsCount = 0;
  private readonly navStates = new Map<string, EnemyTacticalState>();

  // Scratch vectors to avoid per-frame GC pressure
  private readonly tmpEye = new THREE.Vector3();
  private readonly tmpToPlayer = new THREE.Vector3();
  private readonly tmpGuardDir = new THREE.Vector3();
  private readonly tmpLosFrom = new THREE.Vector3();
  private readonly tmpLosTo = new THREE.Vector3();
  private readonly tmpCheckHi = new THREE.Vector3();
  private readonly tmpCheckLo = new THREE.Vector3();
  private readonly tmpTarget = new THREE.Vector3();

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.navGrid = new NavGrid(ctx.physics);
    this.coverPoints = new CoverPoints(ctx.physics);
    this.lastPhysicsCount = ctx.physics.count;

    this.spawnEnemies();

    // Listen for alarms
    ctx.events.on('alarm', ({ source }) => {
      this.triggerBaseAlarm(source);
    });

    // Listen for sound propagation
    ctx.events.on('noise', ({ origin, radius }) => {
      this.alertEnemiesBySound(origin, radius);
    });
  }

  private createTacticalState(enemy: EnemyEntry): EnemyTacticalState {
    const state: EnemyTacticalState = {
      path: [],
      pathIdx: 0,
      repathTimer: 0,
      coverPos: null,
      peekTimer: Math.random() * 2.5,
      staggerTimer: 0,
      hasCalledRadio: false,
      hasRolledCombatTactic: false,
      flankSide: Math.random() < 0.5 ? 1 : -1,
      flankTarget: null,
      searchSweepTimer: 0,
      baseScanYaw: enemy.mesh.rotation.y,
      crouchOffset: 0,
      pathTarget: new THREE.Vector3(enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z),
    };
    this.navStates.set(enemy.data.id, state);
    return state;
  }

  private getTacticalState(enemy: EnemyEntry): EnemyTacticalState {
    return this.navStates.get(enemy.data.id) ?? this.createTacticalState(enemy);
  }

  private spawnEnemies() {
    const configs = getEnemyRoster(this.ctx.missionId);

    configs.forEach((cfg) => {
      const { group, visorMat, bodyGroup, leftLeg, rightLeg } = EnemyMeshFactory.createSoldierMesh(cfg.role);
      group.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      this.ctx.scene.add(group);

      const enemyData: EnemyData = {
        id: cfg.id,
        name: cfg.name,
        role: cfg.role,
        health: cfg.health,
        maxHealth: cfg.health,
        alertState: 'idle',
        suspicionMeter: 0,
        position: [cfg.pos[0], cfg.pos[1], cfg.pos[2]],
        patrolPoints: cfg.patrol,
        currentPatrolIdx: 0,
        lastKnownPlayerPos: null,
        shootCooldown: 0.5 + Math.random() * 0.8,
        burstCount: 0,
        isTagged: false,
      };

      const entry: EnemyEntry = {
        data: enemyData,
        mesh: group,
        visorMat,
        bodyGroup,
        leftLeg,
        rightLeg,
        walkCycle: Math.random() * 10,
        isDead: false,
        deathAnimTime: 0,
      };

      this.ctx.enemies.push(entry);
      this.createTacticalState(entry);
    });
  }

  /**
   * Briefly staggers a living enemy (e.g. when hit in a limb), interrupting movement and fire.
   */
  public staggerEnemy(enemy: EnemyEntry, duration = 0.6) {
    if (enemy.isDead) return;
    const nav = this.getTacticalState(enemy);
    nav.staggerTimer = Math.max(nav.staggerTimer, duration);
  }

  public update(dt: number) {
    // Lazily rebuild navigation and cover data if physics colliders were added after construction
    if (this.ctx.physics.count !== this.lastPhysicsCount) {
      this.navGrid.rebuild(this.ctx.physics);
      this.coverPoints.rebuild(this.ctx.physics);
      this.lastPhysicsCount = this.ctx.physics.count;
    }

    let anyInCombat = false;
    const env = this.ctx.missionDef.environment;
    const isDaylight = env === 'daylight_radar';
    const isNightOrStorm = env === 'night_depot' || env === 'harbor_storm' || env === 'mountain_dawn';
    const isPowerCut = Boolean((this.ctx.mapData as { powerCut?: boolean })?.powerCut);
    const playerPos = this.ctx.player.pos;

    for (const enemy of this.ctx.enemies) {
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
      const nav = this.getTacticalState(enemy);

      // Keep EnemyData position tuple synchronized with 3D mesh position
      eData.position[0] = ePos.x;
      eData.position[1] = ePos.y;
      eData.position[2] = ePos.z;

      if (nav.repathTimer > 0) {
        nav.repathTimer -= dt;
      }

      // Handle limb-hit stagger reaction
      if (nav.staggerTimer > 0) {
        nav.staggerTimer -= dt;
        enemy.bodyGroup.rotation.z = Math.sin(nav.staggerTimer * 22) * 0.22;
        enemy.bodyGroup.rotation.x = -0.18;
        this.decayLegSwing(enemy, dt);
        if (nav.staggerTimer <= 0) {
          enemy.bodyGroup.rotation.z = 0;
          enemy.bodyGroup.rotation.x = 0;
        }
        continue;
      } else if (enemy.bodyGroup.rotation.z !== 0 || enemy.bodyGroup.rotation.x !== 0) {
        enemy.bodyGroup.rotation.z = 0;
        enemy.bodyGroup.rotation.x = 0;
      }

      const distToPlayer = ePos.distanceTo(playerPos);

      // Vision check (accounts for crouch offset when ducking in cover)
      this.tmpEye.set(ePos.x, ePos.y + 1.6 + nav.crouchOffset * 0.5, ePos.z);
      this.tmpToPlayer.copy(playerPos).sub(this.tmpEye);
      const dist = this.tmpToPlayer.length();
      if (dist > 1e-5) {
        this.tmpToPlayer.divideScalar(dist);
      }

      this.tmpGuardDir.set(0, 0, 1).applyEuler(enemy.mesh.rotation);
      const dot = this.tmpGuardDir.dot(this.tmpToPlayer);

      const baseRange = eData.role === 'sniper' ? 80 : 36;
      let sightRange = isDaylight ? baseRange * 1.4 : baseRange;
      if (isPowerCut && isNightOrStorm) {
        sightRange *= 0.65; // 35% vision reduction when compound power is cut in night/storm
      }
      const fovThreshold = eData.role === 'sniper' ? 0.12 : isDaylight ? 0.25 : 0.35;

      let canSeePlayer = false;
      if (dist < sightRange && (dot > fovThreshold || dist < 3.2)) {
        if (this.ctx.physics.hasLineOfSight(this.tmpEye, playerPos, 0.5)) {
          canSeePlayer = true;
        }
      }

      const inCombatFamily =
        eData.alertState === 'combat' ||
        eData.alertState === 'taking_cover' ||
        eData.alertState === 'flanking';

      if (canSeePlayer) {
        let rate = isDaylight ? 80 : 60;
        if (this.ctx.player.isCrouching) rate *= 0.45;
        if (dist > 25) rate *= 0.5;
        if (isPowerCut && isNightOrStorm) rate *= 0.75;

        eData.suspicionMeter = Math.min(100, eData.suspicionMeter + rate * dt);
        eData.lastKnownPlayerPos = [playerPos.x, playerPos.y, playerPos.z];
        nav.searchSweepTimer = 0;

        if (eData.suspicionMeter >= 100) {
          if (!inCombatFamily) {
            soundManager.playGuardVoice('spotted');
            eData.alertState = 'combat';
          }
        } else if (eData.suspicionMeter > 30 && !inCombatFamily) {
          if (eData.alertState === 'idle') {
            soundManager.playGuardVoice('investigate');
          }
          if (eData.alertState !== 'investigating') {
            eData.alertState = 'suspicious';
          }
        }
      } else {
        if (!inCombatFamily) {
          eData.suspicionMeter = Math.max(0, eData.suspicionMeter - 16 * dt);
          if (eData.suspicionMeter === 0 && !this.ctx.alarm.active) {
            eData.alertState = 'idle';
            nav.path.length = 0;
          }
        }
      }

      const nowInCombatFamily =
        eData.alertState === 'combat' ||
        eData.alertState === 'taking_cover' ||
        eData.alertState === 'flanking';

      // When first entering combat, alert nearby allies within 32m via radio and pick tactical behavior
      if (nowInCombatFamily) {
        anyInCombat = true;

        if (!nav.hasCalledRadio) {
          nav.hasCalledRadio = true;
          this.callNearbyAlliesViaRadio(enemy, playerPos, 32);
        }

        this.evaluateTacticalCombatTransition(enemy, nav, playerPos);
      }

      EnemyMeshFactory.updateVisorColor(enemy.visorMat, eData.alertState);

      // Smoothly restore upright stance when not actively ducking in cover
      if (eData.alertState !== 'taking_cover') {
        nav.crouchOffset = THREE.MathUtils.lerp(nav.crouchOffset, 0, Math.min(1, dt * 8));
        enemy.bodyGroup.position.y = nav.crouchOffset;
      }

      // Execute per-state behavior
      switch (eData.alertState) {
        case 'combat':
          this.updateCombatState(enemy, nav, playerPos, distToPlayer, canSeePlayer, dt);
          break;
        case 'taking_cover':
          this.updateTakingCoverState(enemy, nav, playerPos, distToPlayer, canSeePlayer, dt);
          break;
        case 'flanking':
          this.updateFlankingState(enemy, nav, playerPos, distToPlayer, canSeePlayer, dt);
          break;
        case 'investigating':
        case 'suspicious':
          this.updateInvestigatingState(enemy, nav, dt);
          break;
        case 'idle':
        default:
          this.updateIdlePatrolState(enemy, nav, dt);
          break;
      }
    }

    if (anyInCombat && !this.ctx.alarm.active) {
      this.ctx.alarm.triggerTime += dt;
      if (this.ctx.alarm.triggerTime > 3.8) {
        this.ctx.events.emit('alarm', { source: 'combat' });
      }
    }
  }

  /**
   * Alerts idle allies within `radius` (32m) via tactical radio to investigate the player's position.
   */
  private callNearbyAlliesViaRadio(caller: EnemyEntry, threatPos: THREE.Vector3, radius: number) {
    const radiusSq = radius * radius;
    for (const ally of this.ctx.enemies) {
      if (ally === caller || ally.isDead) continue;
      if (ally.data.alertState === 'idle') {
        const dSq = ally.mesh.position.distanceToSquared(caller.mesh.position);
        if (dSq <= radiusSq) {
          ally.data.alertState = 'investigating';
          ally.data.suspicionMeter = Math.max(ally.data.suspicionMeter, 80);
          ally.data.lastKnownPlayerPos = [threatPos.x, threatPos.y, threatPos.z];
          const allyNav = this.getTacticalState(ally);
          allyNav.repathTimer = 0;
          allyNav.searchSweepTimer = 0;
          EnemyMeshFactory.updateVisorColor(ally.visorMat, 'investigating');
        }
      }
    }
  }

  /**
   * Decides whether a patrol or officer guard should transition into `taking_cover` or `flanking`.
   */
  private evaluateTacticalCombatTransition(
    enemy: EnemyEntry,
    nav: EnemyTacticalState,
    playerPos: THREE.Vector3
  ) {
    const eData = enemy.data;
    if (eData.role === 'sniper' || eData.role === 'heavy') {
      return;
    }

    const lowHealth = eData.health < eData.maxHealth * 0.6;

    // Immediately seek cover when wounded below 60% health if not already in cover
    if (lowHealth && eData.alertState === 'combat') {
      const cover = this.coverPoints.findBestCover(enemy.mesh.position, playerPos, this.ctx.physics, 22);
      if (cover) {
        nav.coverPos = cover;
        nav.repathTimer = 0;
        nav.peekTimer = 0;
        eData.alertState = 'taking_cover';
        return;
      }
    }

    // Roll initial combat entry maneuver for patrol / officer roles
    if (!nav.hasRolledCombatTactic && eData.alertState === 'combat') {
      nav.hasRolledCombatTactic = true;
      const roll = Math.random();
      if (roll < 0.45) {
        const cover = this.coverPoints.findBestCover(enemy.mesh.position, playerPos, this.ctx.physics, 22);
        if (cover) {
          nav.coverPos = cover;
          nav.repathTimer = 0;
          nav.peekTimer = 0;
          eData.alertState = 'taking_cover';
          return;
        }
      } else if (roll < 0.78) {
        nav.flankTarget = this.computeFlankTarget(enemy.mesh.position, playerPos, nav.flankSide);
        nav.repathTimer = 0;
        eData.alertState = 'flanking';
      }
    }
  }

  private computeFlankTarget(enemyPos: THREE.Vector3, playerPos: THREE.Vector3, side: number): THREE.Vector3 {
    const dx = playerPos.x - enemyPos.x;
    const dz = playerPos.z - enemyPos.z;
    const len = Math.hypot(dx, dz) || 1;
    const perpX = (-dz / len) * side;
    const perpZ = (dx / len) * side;

    const candidateX = THREE.MathUtils.clamp(playerPos.x + perpX * 11 - (dx / len) * 4, -62, 62);
    const candidateZ = THREE.MathUtils.clamp(playerPos.z + perpZ * 11 - (dz / len) * 4, -62, 62);
    return new THREE.Vector3(candidateX, enemyPos.y, candidateZ);
  }

  private updateCombatState(
    enemy: EnemyEntry,
    nav: EnemyTacticalState,
    playerPos: THREE.Vector3,
    distToPlayer: number,
    canSeePlayer: boolean,
    dt: number
  ) {
    const eData = enemy.data;
    const ePos = enemy.mesh.position;

    // Sniper: remains stationed on watchtower platform, tracks and fires when player is in LOS
    if (eData.role === 'sniper') {
      const angleToPlayer = Math.atan2(playerPos.x - ePos.x, playerPos.z - ePos.z);
      enemy.mesh.rotation.y = angleToPlayer;
      this.decayLegSwing(enemy, dt);

      eData.shootCooldown -= dt;
      if (eData.shootCooldown <= 0 && distToPlayer < 85 && canSeePlayer) {
        this.enemyShootAtPlayer(enemy);
        eData.shootCooldown = 2.1 + Math.random() * 0.4;
      }
      return;
    }

    // Heavy: advances methodically along A* path toward player while firing bursts
    if (eData.role === 'heavy') {
      this.handleBurstFire(enemy, distToPlayer, canSeePlayer, dt, 48);
      if (distToPlayer > 7.5 || !canSeePlayer) {
        this.followPathToward(enemy, nav, playerPos, 2.5, dt, !canSeePlayer);
      } else {
        this.decayLegSwing(enemy, dt);
      }
      if (canSeePlayer) {
        enemy.mesh.rotation.y = Math.atan2(playerPos.x - ePos.x, playerPos.z - ePos.z);
      }
      return;
    }

    // Patrol / Officer in direct combat
    this.handleBurstFire(enemy, distToPlayer, canSeePlayer, dt, 45);
    if (distToPlayer > 11 || !canSeePlayer) {
      this.followPathToward(enemy, nav, playerPos, 3.6, dt, !canSeePlayer);
    } else {
      this.decayLegSwing(enemy, dt);
    }
    if (canSeePlayer) {
      enemy.mesh.rotation.y = Math.atan2(playerPos.x - ePos.x, playerPos.z - ePos.z);
    }
  }

  private updateTakingCoverState(
    enemy: EnemyEntry,
    nav: EnemyTacticalState,
    playerPos: THREE.Vector3,
    distToPlayer: number,
    canSeePlayer: boolean,
    dt: number
  ) {
    const eData = enemy.data;
    const ePos = enemy.mesh.position;

    if (!nav.coverPos) {
      nav.coverPos = this.coverPoints.findBestCover(ePos, playerPos, this.ctx.physics, 22);
      if (!nav.coverPos) {
        eData.alertState = 'combat';
        return;
      }
    }

    const dx = nav.coverPos.x - ePos.x;
    const dz = nav.coverPos.z - ePos.z;
    const distToCover = Math.hypot(dx, dz);

    if (distToCover > 1.1) {
      // Moving to cover position
      nav.crouchOffset = THREE.MathUtils.lerp(nav.crouchOffset, 0, Math.min(1, dt * 8));
      enemy.bodyGroup.position.y = nav.crouchOffset;
      this.followPathToward(enemy, nav, nav.coverPos, 3.9, dt, true);

      // Suppressing fire while moving if player is visible
      if (canSeePlayer) {
        this.handleBurstFire(enemy, distToPlayer, canSeePlayer, dt, 42);
      }
    } else {
      // Arrived at cover: alternate between ducking behind cover and peeking up to fire
      this.decayLegSwing(enemy, dt);
      enemy.mesh.rotation.y = Math.atan2(playerPos.x - ePos.x, playerPos.z - ePos.z);

      nav.peekTimer += dt;
      const cycle = nav.peekTimer % 3.2;
      const isPeeking = cycle >= 1.6;

      const targetCrouch = isPeeking ? 0 : -0.42;
      nav.crouchOffset = THREE.MathUtils.lerp(nav.crouchOffset, targetCrouch, Math.min(1, dt * 10));
      enemy.bodyGroup.position.y = nav.crouchOffset;

      if (isPeeking) {
        this.handleBurstFire(enemy, distToPlayer, true, dt, 45);
      }

      // Re-evaluate cover if player flanked around and now has clear LOS to the crouched cover point
      if (nav.peekTimer > 3.2) {
        nav.peekTimer = 0;
        this.tmpLosFrom.set(nav.coverPos.x, 1.2, nav.coverPos.z);
        this.tmpLosTo.set(playerPos.x, 1.5, playerPos.z);
        if (this.ctx.physics.hasLineOfSight(this.tmpLosFrom, this.tmpLosTo, 0.25)) {
          const newCover = this.coverPoints.findBestCover(ePos, playerPos, this.ctx.physics, 22);
          if (newCover) {
            nav.coverPos = newCover;
            nav.repathTimer = 0;
          } else {
            nav.flankSide = -nav.flankSide;
            nav.flankTarget = this.computeFlankTarget(ePos, playerPos, nav.flankSide);
            nav.repathTimer = 0;
            eData.alertState = 'flanking';
          }
        }
      }
    }
  }

  private updateFlankingState(
    enemy: EnemyEntry,
    nav: EnemyTacticalState,
    playerPos: THREE.Vector3,
    distToPlayer: number,
    canSeePlayer: boolean,
    dt: number
  ) {
    const eData = enemy.data;
    const ePos = enemy.mesh.position;

    if (!nav.flankTarget || nav.repathTimer <= 0) {
      nav.flankTarget = this.computeFlankTarget(ePos, playerPos, nav.flankSide);
    }

    const distToFlank = Math.hypot(nav.flankTarget.x - ePos.x, nav.flankTarget.z - ePos.z);
    if (distToFlank < 1.8) {
      // Reached flank position; transition to cover or direct combat engagement
      const cover = this.coverPoints.findBestCover(ePos, playerPos, this.ctx.physics, 18);
      if (cover && eData.health < eData.maxHealth * 0.75) {
        nav.coverPos = cover;
        nav.repathTimer = 0;
        eData.alertState = 'taking_cover';
      } else {
        eData.alertState = 'combat';
      }
      return;
    }

    this.followPathToward(enemy, nav, nav.flankTarget, 3.7, dt, !canSeePlayer);

    if (canSeePlayer) {
      enemy.mesh.rotation.y = Math.atan2(playerPos.x - ePos.x, playerPos.z - ePos.z);
      this.handleBurstFire(enemy, distToPlayer, canSeePlayer, dt, 45);
    }
  }

  private updateInvestigatingState(enemy: EnemyEntry, nav: EnemyTacticalState, dt: number) {
    const eData = enemy.data;
    const ePos = enemy.mesh.position;

    if (eData.role === 'sniper') {
      nav.searchSweepTimer += dt;
      enemy.mesh.rotation.y = nav.baseScanYaw + Math.sin(nav.searchSweepTimer * 1.4) * 0.9;
      return;
    }

    if (!eData.lastKnownPlayerPos) {
      eData.alertState = 'idle';
      return;
    }

    this.tmpTarget.set(eData.lastKnownPlayerPos[0], ePos.y, eData.lastKnownPlayerPos[2]);
    const distToTarget = Math.hypot(this.tmpTarget.x - ePos.x, this.tmpTarget.z - ePos.z);

    if (distToTarget > 1.6) {
      const speed = eData.alertState === 'investigating' ? 2.4 : 2.0;
      this.followPathToward(enemy, nav, this.tmpTarget, speed, dt, true);
      nav.baseScanYaw = enemy.mesh.rotation.y;
    } else {
      // Arrived at lastKnownPlayerPos: stop and sweep look direction
      this.decayLegSwing(enemy, dt);
      nav.searchSweepTimer += dt;
      enemy.mesh.rotation.y = nav.baseScanYaw + Math.sin(nav.searchSweepTimer * 2.2) * 1.15;

      if (nav.searchSweepTimer > 7.5 && !this.ctx.alarm.active) {
        eData.suspicionMeter = Math.max(0, eData.suspicionMeter - 25 * dt);
        if (eData.suspicionMeter <= 0) {
          eData.alertState = 'idle';
          eData.lastKnownPlayerPos = null;
          nav.path.length = 0;
        }
      }
    }
  }

  private updateIdlePatrolState(enemy: EnemyEntry, nav: EnemyTacticalState, dt: number) {
    const eData = enemy.data;
    const ePos = enemy.mesh.position;

    if (eData.role === 'sniper' || eData.patrolPoints.length <= 1) {
      nav.searchSweepTimer += dt;
      if (eData.role === 'sniper') {
        enemy.mesh.rotation.y = nav.baseScanYaw + Math.sin(nav.searchSweepTimer * 0.7) * 0.65;
      }
      this.decayLegSwing(enemy, dt);
      return;
    }

    const curTarget = eData.patrolPoints[eData.currentPatrolIdx];
    this.tmpTarget.set(curTarget[0], ePos.y, curTarget[2]);
    const distToWaypoint = Math.hypot(this.tmpTarget.x - ePos.x, this.tmpTarget.z - ePos.z);

    if (distToWaypoint < 0.9) {
      eData.currentPatrolIdx = (eData.currentPatrolIdx + 1) % eData.patrolPoints.length;
      nav.path.length = 0;
      nav.pathIdx = 0;
      return;
    }

    this.followPathToward(enemy, nav, this.tmpTarget, 1.6, dt, true);
  }

  /**
   * Moves an enemy toward `goal` using direct movement when LOS is clear, or A* via `NavGrid` when blocked.
   */
  private followPathToward(
    enemy: EnemyEntry,
    nav: EnemyTacticalState,
    goal: THREE.Vector3,
    speed: number,
    dt: number,
    faceMovementDir: boolean
  ) {
    const ePos = enemy.mesh.position;

    this.tmpLosFrom.set(ePos.x, 1.0, ePos.z);
    this.tmpLosTo.set(goal.x, 1.0, goal.z);
    const hasDirectLos = this.ctx.physics.hasLineOfSight(this.tmpLosFrom, this.tmpLosTo, 0.35);

    let steerX = goal.x;
    let steerZ = goal.z;

    if (hasDirectLos && nav.path.length <= 1) {
      nav.path.length = 0;
      nav.pathIdx = 0;
    } else {
      const targetMovedSq =
        (goal.x - nav.pathTarget.x) * (goal.x - nav.pathTarget.x) +
        (goal.z - nav.pathTarget.z) * (goal.z - nav.pathTarget.z);

      if (nav.path.length === 0 || nav.pathIdx >= nav.path.length || ( nav.repathTimer <= 0 && targetMovedSq > 2.25)) {
        nav.path = this.navGrid.findPath(ePos, goal, this.ctx.physics);
        nav.pathIdx = 0;
        nav.repathTimer = 0.65 + Math.random() * 0.25;
        nav.pathTarget.copy(goal);
      }

      if (nav.pathIdx < nav.path.length) {
        let wp = nav.path[nav.pathIdx];
        const dWp = Math.hypot(wp.x - ePos.x, wp.z - ePos.z);
        if (dWp < 0.75 && nav.pathIdx < nav.path.length - 1) {
          nav.pathIdx++;
          wp = nav.path[nav.pathIdx];
        }
        steerX = wp.x;
        steerZ = wp.z;
      }
    }

    const dx = steerX - ePos.x;
    const dz = steerZ - ePos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      this.decayLegSwing(enemy, dt);
      return;
    }

    const dirX = dx / dist;
    const dirZ = dz / dist;

    if (faceMovementDir) {
      enemy.mesh.rotation.y = Math.atan2(dirX, dirZ);
    }

    this.moveEnemyWithCollision(enemy, nav, dirX, dirZ, speed, dt);
  }

  /**
   * Moves an enemy while checking `this.ctx.physics.containsPoint` and ally separation
   * so moving guards never walk through walls or overlap each other.
   */
  private moveEnemyWithCollision(
    enemy: EnemyEntry,
    nav: EnemyTacticalState,
    dirX: number,
    dirZ: number,
    speed: number,
    dt: number
  ) {
    const ePos = enemy.mesh.position;

    // Subtle repulsion from nearby living allies
    let sepX = 0;
    let sepZ = 0;
    for (const other of this.ctx.enemies) {
      if (other === enemy || other.isDead) continue;
      const ox = ePos.x - other.mesh.position.x;
      const oz = ePos.z - other.mesh.position.z;
      const dSq = ox * ox + oz * oz;
      if (dSq > 0.0001 && dSq < 0.9) {
        const d = Math.sqrt(dSq);
        const push = (0.95 - d) * 0.6;
        sepX += (ox / d) * push;
        sepZ += (oz / d) * push;
      }
    }

    let moveX = dirX + sepX;
    let moveZ = dirZ + sepZ;
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 1e-5) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const stepX = moveX * speed * dt;
    const stepZ = moveZ * speed * dt;

    if (this.canOccupyPosition(ePos.x + stepX, ePos.y, ePos.z + stepZ, moveX, moveZ)) {
      ePos.x += stepX;
      ePos.z += stepZ;
      this.animateEnemyLegs(enemy, dt, speed);
      return;
    }

    // Axis-aligned wall sliding fallback
    if (Math.abs(stepX) > 1e-5 && this.canOccupyPosition(ePos.x + stepX, ePos.y, ePos.z, Math.sign(stepX), 0)) {
      ePos.x += stepX;
      this.animateEnemyLegs(enemy, dt, speed * 0.75);
      return;
    }

    if (Math.abs(stepZ) > 1e-5 && this.canOccupyPosition(ePos.x, ePos.y, ePos.z + stepZ, 0, Math.sign(stepZ))) {
      ePos.z += stepZ;
      this.animateEnemyLegs(enemy, dt, speed * 0.75);
      return;
    }

    // Blocked on both axes: trigger immediate A* repath on next frame
    nav.repathTimer = 0;
    this.decayLegSwing(enemy, dt);
  }

  private canOccupyPosition(x: number, y: number, z: number, dirX: number, dirZ: number): boolean {
    const pad = 0.38;
    // Check center and leading edge at knee and chest height
    this.tmpCheckLo.set(x, y + 0.55, z);
    this.tmpCheckHi.set(x, y + 1.15, z);
    if (this.ctx.physics.containsPoint(this.tmpCheckLo) || this.ctx.physics.containsPoint(this.tmpCheckHi)) {
      return false;
    }

    this.tmpCheckLo.set(x + dirX * pad, y + 0.55, z + dirZ * pad);
    this.tmpCheckHi.set(x + dirX * pad, y + 1.15, z + dirZ * pad);
    if (this.ctx.physics.containsPoint(this.tmpCheckLo) || this.ctx.physics.containsPoint(this.tmpCheckHi)) {
      return false;
    }

    return true;
  }

  private handleBurstFire(
    enemy: EnemyEntry,
    distToPlayer: number,
    canSeePlayer: boolean,
    dt: number,
    maxRange: number
  ) {
    const eData = enemy.data;
    eData.shootCooldown -= dt;
    if (eData.shootCooldown > 0 || distToPlayer >= maxRange || !canSeePlayer) {
      return;
    }

    this.enemyShootAtPlayer(enemy);
    eData.burstCount++;

    const maxBurst = eData.role === 'heavy' ? 5 : eData.role === 'officer' ? 4 : 3;
    if (eData.burstCount >= maxBurst) {
      eData.burstCount = 0;
      eData.shootCooldown = eData.role === 'heavy' ? 0.65 + Math.random() * 0.25 : 0.85 + Math.random() * 0.35;
    } else {
      eData.shootCooldown = eData.role === 'heavy' ? 0.12 : 0.16 + Math.random() * 0.08;
    }
  }

  private animateEnemyLegs(enemy: EnemyEntry, dt: number, speed: number) {
    enemy.walkCycle += dt * speed * 4;
    const legSwing = Math.sin(enemy.walkCycle) * 0.45;
    enemy.leftLeg.rotation.x = legSwing;
    enemy.rightLeg.rotation.x = -legSwing;
  }

  private decayLegSwing(enemy: EnemyEntry, dt: number) {
    const t = Math.min(1, dt * 10);
    enemy.leftLeg.rotation.x = THREE.MathUtils.lerp(enemy.leftLeg.rotation.x, 0, t);
    enemy.rightLeg.rotation.x = THREE.MathUtils.lerp(enemy.rightLeg.rotation.x, 0, t);
  }

  private enemyShootAtPlayer(enemy: EnemyEntry) {
    const role = enemy.data.role;
    const isSniper = role === 'sniper';
    const accuracy = isSniper ? 0.75 : role === 'officer' ? 0.52 : role === 'heavy' ? 0.48 : 0.42;
    const gunMuzzle = enemy.mesh.position
      .clone()
      .add(new THREE.Vector3(0.12, 1.1 + enemy.bodyGroup.position.y * 0.5, 0.4));

    // Spatial-grid line of sight check
    if (!this.ctx.physics.hasLineOfSight(gunMuzzle, this.ctx.player.pos, 0.4)) {
      return;
    }

    if (isSniper) soundManager.playSniperShot();
    else soundManager.playAk74mShot();

    if (Math.random() < accuracy) {
      const dmg = isSniper ? 35 : role === 'heavy' ? 14 : 12;
      this.ctx.systems.player.damage(dmg, enemy.mesh.position);
    }

    this.ctx.systems.vfx.createBulletTracer(
      gunMuzzle,
      this.ctx.camera.position.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)
      )
    );
  }

  public killEnemy(enemy: EnemyEntry, headshot: boolean) {
    enemy.isDead = true;
    enemy.data.alertState = 'dead';
    enemy.bodyGroup.position.y = 0;
    enemy.bodyGroup.rotation.set(0, 0, 0);
    this.ctx.stats.kills++;
    soundManager.playGuardVoice('death');
    EnemyMeshFactory.updateVisorColor(enemy.visorMat, 'dead');

    this.ctx.events.emit('enemyKilled', { enemy, headshot });
  }

  public alertEnemiesBySound(origin: THREE.Vector3, radius: number) {
    for (const enemy of this.ctx.enemies) {
      if (enemy.isDead) continue;
      const d = enemy.mesh.position.distanceTo(origin);
      if (d < radius && (enemy.data.alertState === 'idle' || enemy.data.alertState === 'suspicious')) {
        const nav = this.getTacticalState(enemy);
        enemy.data.alertState = d < radius * 0.55 ? 'investigating' : 'suspicious';
        enemy.data.suspicionMeter = Math.max(enemy.data.suspicionMeter, 65);
        enemy.data.lastKnownPlayerPos = [origin.x, origin.y, origin.z];
        nav.repathTimer = 0;
        nav.searchSweepTimer = 0;
        EnemyMeshFactory.updateVisorColor(enemy.visorMat, enemy.data.alertState);
        soundManager.playGuardVoice('investigate');
      }
    }
  }

  public triggerBaseAlarm(source: string) {
    void source;
    if (this.ctx.alarm.active) return;
    this.ctx.alarm.active = true;
    this.ctx.stats.alarms++;
    soundManager.startBaseSiren();

    for (const enemy of this.ctx.enemies) {
      const state = enemy.data.alertState;
      const inCombat = state === 'combat' || state === 'taking_cover' || state === 'flanking';
      if (!enemy.isDead && !inCombat) {
        const nav = this.getTacticalState(enemy);
        enemy.data.alertState = 'investigating';
        enemy.data.suspicionMeter = 90;
        enemy.data.lastKnownPlayerPos = [this.ctx.player.pos.x, this.ctx.player.pos.y, this.ctx.player.pos.z];
        nav.repathTimer = 0;
        nav.searchSweepTimer = 0;
        EnemyMeshFactory.updateVisorColor(enemy.visorMat, 'investigating');
      }
    }
  }
}
