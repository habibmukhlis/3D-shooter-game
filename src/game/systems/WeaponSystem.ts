import * as THREE from 'three';
import { soundManager } from '../../audio/SoundManager';
import type { WeaponData } from '../../types/game';
import { WeaponMeshFactory } from '../WeaponMeshFactory';
import type { EnemyEntry, GameContext, GameSystem } from '../core/GameContext';
import { createDefaultLoadout } from '../data/weapons';
import type { BreakableProp, ExplosiveBarrel, SurveillanceCameraMesh } from '../MapBuilder';

interface ActiveGrenade {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuseTimer: number;
}

interface ActiveRocket {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
}

interface PlantedC4 {
  mesh: THREE.Group;
  pos: THREE.Vector3;
}

export class WeaponSystem implements GameSystem {
  private ctx: GameContext;
  public weapons: WeaponData[];
  public currentWeaponIdx = 1;
  public isReloading = false;
  public reloadTimer = 0;
  public shootCooldown = 0;

  private weaponMeshGroup: THREE.Group;
  private currentWeaponMesh: THREE.Group | null = null;
  private muzzleFlashLight: THREE.PointLight;

  private weaponKickZ = 0;
  private weaponKickPitch = 0;
  private burstShotIndex = 0;

  private activeGrenades: ActiveGrenade[] = [];
  private activeRockets: ActiveRocket[] = [];
  private plantedC4List: PlantedC4[] = [];

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.weapons = createDefaultLoadout();

    // Setup weapon rig on camera
    this.weaponMeshGroup = new THREE.Group();
    ctx.camera.add(this.weaponMeshGroup);

    this.muzzleFlashLight = new THREE.PointLight(0xffedd5, 0, 10);
    this.muzzleFlashLight.position.set(0.18, -0.15, -0.7);
    ctx.camera.add(this.muzzleFlashLight);

    this.updateWeaponMesh();

    // Bind input actions
    ctx.systems.input.onAction((action) => {
      switch (action) {
        case 'weapon1': this.switchWeapon(0); break;
        case 'weapon2': this.switchWeapon(1); break;
        case 'weapon3': this.switchWeapon(2); break;
        case 'weapon4': this.switchWeapon(3); break;
        case 'weapon5': this.switchWeapon(4); break;
        case 'weaponNext': this.cycleWeapon(1); break;
        case 'weaponPrev': this.cycleWeapon(-1); break;
        case 'reload': this.triggerReload(); break;
        case 'grenade': this.throwGrenade(); break;
        case 'gadget': this.plantOrDetonateC4(); break;
        case 'firePress':
          if (!this.weapons[this.currentWeaponIdx].isAutomatic) {
            this.triggerFire();
          }
          break;
        case 'binoculars':
          if (this.currentWeaponMesh) {
            this.currentWeaponMesh.visible = !ctx.player.isBinoculars;
          }
          break;
      }
    });
  }

  public get currentWeapon(): WeaponData {
    return this.weapons[this.currentWeaponIdx];
  }

  public cycleWeapon(dir: number) {
    const next = (this.currentWeaponIdx + dir + this.weapons.length) % this.weapons.length;
    this.switchWeapon(next);
  }

  public switchWeapon(idx: number) {
    if (this.ctx.player.isBinoculars) {
      this.ctx.systems.hud.toggleBinoculars();
    }
    if (idx === this.currentWeaponIdx || idx < 0 || idx >= this.weapons.length || this.isReloading) return;
    this.currentWeaponIdx = idx;
    this.ctx.player.isAiming = false;
    this.shootCooldown = 0.3;
    this.burstShotIndex = 0;
    soundManager.playFootstep(false, true);
    this.updateWeaponMesh();
  }

  public updateWeaponMesh() {
    while (this.weaponMeshGroup.children.length > 0) {
      this.weaponMeshGroup.remove(this.weaponMeshGroup.children[0]);
    }
    const cur = this.weapons[this.currentWeaponIdx];
    this.currentWeaponMesh = WeaponMeshFactory.createWeaponMesh(cur.id);
    if (this.ctx.player.isBinoculars) {
      this.currentWeaponMesh.visible = false;
    }
    this.weaponMeshGroup.add(this.currentWeaponMesh);
  }

  public triggerReload() {
    const cur = this.weapons[this.currentWeaponIdx];
    if (this.isReloading || cur.ammo === cur.magSize || cur.reserve <= 0 || cur.id === 'knife') return;
    this.isReloading = true;
    this.reloadTimer = cur.reloadTime;
    soundManager.playReload();
  }

  public throwGrenade() {
    if (this.ctx.player.grenades <= 0) {
      soundManager.playDryFire();
      return;
    }
    this.ctx.player.grenades--;
    soundManager.playKnifeSlash();

    const gGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7, metalness: 0.3 })
    );
    gGroup.add(body);

    const fuseLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    fuseLed.position.set(0, 0.11, 0);
    gGroup.add(fuseLed);

    const camEuler = this.ctx.getAimEuler();
    const forward = new THREE.Vector3(0, 0.16, -1).applyEuler(camEuler).normalize();
    const startPos = this.ctx.camera.position.clone().addScaledVector(forward, 0.65);
    gGroup.position.copy(startPos);
    this.ctx.scene.add(gGroup);

    this.activeGrenades.push({
      mesh: gGroup,
      pos: startPos,
      vel: forward.multiplyScalar(17.5).add(new THREE.Vector3(0, 3.2, 0)),
      fuseTimer: 2.6,
    });
  }

  public plantOrDetonateC4() {
    if (this.ctx.player.c4Planted && this.plantedC4List.length > 0) {
      // Remote detonate all planted C4 charges
      soundManager.playHackSound();
      const charges = [...this.plantedC4List];
      this.plantedC4List.length = 0;
      this.ctx.player.c4Planted = false;

      for (const c4 of charges) {
        this.ctx.scene.remove(c4.mesh);
        this.triggerExplosionAt(c4.pos, 12.5, 220);
      }
      return;
    }

    if (this.ctx.player.c4Count <= 0) {
      soundManager.playDryFire();
      return;
    }

    this.ctx.player.c4Count--;
    this.ctx.player.c4Planted = true;
    soundManager.playHackSound();

    // Check if near a c4_target manifold to snap directly onto it
    let plantPos = this.ctx.player.pos
      .clone()
      .add(new THREE.Vector3(0, 0.9, 0))
      .add(new THREE.Vector3(0, 0, -1.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.ctx.player.yaw));

    for (const item of this.ctx.mapData.interactiveItems) {
      if (item.type === 'c4_target' && !item.isCollected) {
        if (this.ctx.player.pos.distanceTo(item.position) < 4.2) {
          plantPos = item.position.clone().add(new THREE.Vector3(0, 0.35, 0));
          break;
        }
      }
    }

    const c4Group = new THREE.Group();
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.7 })
    );
    c4Group.add(pack);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    beacon.position.set(0, 0.09, 0);
    c4Group.add(beacon);

    c4Group.position.copy(plantPos);
    this.ctx.scene.add(c4Group);
    this.plantedC4List.push({ mesh: c4Group, pos: plantPos });
  }

  public triggerFire() {
    if (this.ctx.player.isBinoculars) return;
    const cur = this.weapons[this.currentWeaponIdx];
    if (this.isReloading || this.shootCooldown > 0) return;

    if (cur.ammo <= 0) {
      soundManager.playDryFire();
      this.shootCooldown = 0.3;
      return;
    }

    cur.ammo--;
    this.ctx.stats.shotsFired++;
    this.shootCooldown = 1 / cur.fireRate;
    this.burstShotIndex = Math.min(12, this.burstShotIndex + 1);

    // Weapon Sound
    if (cur.id === 'ak74m') soundManager.playAk74mShot();
    else if (cur.id === 'silenced_pistol') soundManager.playSilencedShot();
    else if (cur.id === 'sniper') soundManager.playSniperShot();
    else if (cur.id === 'rpg7') soundManager.playExplosion();
    else soundManager.playKnifeSlash();

    // Sound alert
    if (!cur.isSilenced) {
      this.ctx.events.emit('noise', {
        origin: this.ctx.player.pos.clone(),
        radius: cur.id === 'rpg7' ? 85 : cur.id === 'sniper' ? 65 : 45,
        kind: 'gunshot',
      });
    }

    // Per-weapon recoil pattern + visual weapon kick
    const crouchFactor = this.ctx.player.isCrouching ? 0.65 : 1.0;
    const adsFactor = this.ctx.player.isAiming ? 0.7 : 1.0;
    const patternDrift = Math.sin(this.burstShotIndex * 1.15) * 0.45 + (Math.random() - 0.5) * 0.35;
    this.ctx.player.recoilPitch += cur.recoil * crouchFactor * adsFactor;
    this.ctx.player.recoilYaw += cur.recoil * patternDrift * crouchFactor * adsFactor;

    this.weaponKickZ = Math.min(0.08, this.weaponKickZ + (cur.id === 'sniper' || cur.id === 'rpg7' ? 0.065 : 0.028));
    this.weaponKickPitch = Math.min(0.14, this.weaponKickPitch + cur.recoil * 1.1);

    // Muzzle Flash
    if (this.muzzleFlashLight && cur.id !== 'knife') {
      this.muzzleFlashLight.intensity = cur.isSilenced ? 0.8 : 4.0;
      setTimeout(() => {
        if (this.muzzleFlashLight) this.muzzleFlashLight.intensity = 0;
      }, 45);
    }

    if (cur.id === 'rpg7') {
      this.launchRocket();
    } else {
      this.fireRaycast(cur);
    }
  }

  private launchRocket() {
    const camEuler = this.ctx.getAimEuler();
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camEuler).normalize();
    const startPos = this.ctx.camera.position.clone().addScaledVector(dir, 0.8);

    const rocketGroup = new THREE.Group();
    const warhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.36, 8),
      new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.5 })
    );
    warhead.rotation.x = -Math.PI / 2;
    rocketGroup.add(warhead);

    const thrusterLight = new THREE.PointLight(0xf97316, 4, 8);
    thrusterLight.position.set(0, 0, 0.25);
    rocketGroup.add(thrusterLight);

    rocketGroup.position.copy(startPos);
    rocketGroup.lookAt(startPos.clone().add(dir));
    this.ctx.scene.add(rocketGroup);

    this.activeRockets.push({
      mesh: rocketGroup,
      pos: startPos,
      vel: dir.multiplyScalar(54),
      age: 0,
    });
  }

  private damageBreakableProp(prop: BreakableProp, amount: number, hitPoint: THREE.Vector3) {
    if (prop.isBroken) return;
    prop.health -= amount;
    if (prop.kind === 'window') {
      this.ctx.systems.vfx.createGlassShatter(hitPoint);
    } else {
      this.ctx.systems.vfx.createWoodSplinters(hitPoint);
    }

    if (prop.health <= 0) {
      prop.isBroken = true;
      this.ctx.scene.remove(prop.mesh);
      this.ctx.physics.setBoxEnabled(prop.box, false);
      soundManager.playMetalRicochet();
    }
  }

  private fireRaycast(weapon: WeaponData) {
    const isAiming = this.ctx.player.isAiming;
    const spread = isAiming ? weapon.spread * 0.28 : weapon.spread;
    const spreadX = (Math.random() - 0.5) * spread;
    const spreadY = (Math.random() - 0.5) * spread;

    const muzzleOffset = new THREE.Vector3(0.18, -0.15, -0.4);
    const cameraRot = this.ctx.getAimEuler();
    const physicalMuzzle = this.ctx.camera.position.clone().add(muzzleOffset.clone().applyEuler(cameraRot));

    // 1. Barrel obstruction check via PhysicsWorld spatial grid
    if (this.ctx.physics.containsPoint(physicalMuzzle)) {
      this.ctx.systems.vfx.createHitSparks(physicalMuzzle);
      this.ctx.systems.vfx.createBulletDecal(physicalMuzzle);
      soundManager.playMetalRicochet();
      return;
    }

    const shootDir = new THREE.Vector3(spreadX, spreadY, -1).applyEuler(cameraRot).normalize();
    const rayOrigin = this.ctx.camera.position.clone();

    // 2. World geometry hitscan via PhysicsWorld DDA raycast
    const hit = this.ctx.physics.raycast(rayOrigin, shootDir, weapon.range);
    let minObstacleDist = hit ? hit.distance : weapon.range;
    let obstacleHitPoint = hit ? hit.point.clone() : null;
    let obstacleNormal = hit ? hit.normal.clone() : undefined;

    const raycaster = new THREE.Raycaster(rayOrigin, shootDir, 0.05, weapon.range);

    // 2b. Breakable props check (glass windows shatter and let bullets through; crates block until broken)
    const breakables = this.ctx.mapData.breakableProps ?? [];
    let crateHit: { prop: BreakableProp; point: THREE.Vector3 } | null = null;
    for (const prop of breakables) {
      if (prop.isBroken) continue;
      const bPt = new THREE.Vector3();
      if (raycaster.ray.intersectBox(prop.box, bPt)) {
        const d = rayOrigin.distanceTo(bPt);
        if (d < minObstacleDist) {
          if (prop.kind === 'window') {
            this.damageBreakableProp(prop, weapon.damage, bPt);
          } else {
            minObstacleDist = d;
            obstacleHitPoint = bPt.clone();
            crateHit = { prop, point: bPt.clone() };
          }
        }
      }
    }

    // 3. Explosive Barrels check
    let barrelHit: { barrel: ExplosiveBarrel; dist: number } | null = null;
    for (const barrel of this.ctx.mapData.explosiveBarrels) {
      if (barrel.isExploded) continue;
      const bHitPt = new THREE.Vector3();
      const bBox = new THREE.Box3().setFromObject(barrel.mesh);
      if (raycaster.ray.intersectBox(bBox, bHitPt)) {
        const d = rayOrigin.distanceTo(bHitPt);
        if (d < minObstacleDist) {
          minObstacleDist = d;
          obstacleHitPoint = bHitPt.clone();
          obstacleNormal = new THREE.Vector3(0, 1, 0);
          barrelHit = { barrel, dist: d };
          crateHit = null;
        }
      }
    }

    // 4. Surveillance Cameras check
    let cameraHit: SurveillanceCameraMesh | null = null;
    for (const cam of this.ctx.mapData.cameras) {
      if (cam.isDestroyed) continue;
      const camPos = cam.mount.position;
      const d = raycaster.ray.distanceToPoint(camPos);
      const distFromPlayer = rayOrigin.distanceTo(camPos);
      if (d < 0.45 && distFromPlayer < minObstacleDist) {
        minObstacleDist = distFromPlayer;
        obstacleHitPoint = camPos.clone();
        cameraHit = cam;
        barrelHit = null;
        crateHit = null;
      }
    }

    // 5. Enemies check with limb hitboxes ('head' | 'torso' | 'arm' | 'leg')
    let closestEnemyHit: {
      enemy: EnemyEntry;
      dist: number;
      hitbox: 'head' | 'torso' | 'arm' | 'leg';
      point: THREE.Vector3;
    } | null = null;

    for (const enemy of this.ctx.enemies) {
      if (enemy.isDead) continue;
      const distFromPlayer = rayOrigin.distanceTo(enemy.mesh.position);
      if (distFromPlayer >= minObstacleDist) continue;

      // First try exact mesh intersection for tagged limb meshes
      const intersects = raycaster.intersectObject(enemy.mesh, true);
      if (intersects.length > 0 && intersects[0].distance < minObstacleDist) {
        let obj: THREE.Object3D | null = intersects[0].object;
        let zone: 'head' | 'torso' | 'arm' | 'leg' = 'torso';
        while (obj) {
          if (obj.userData?.hitbox) {
            zone = obj.userData.hitbox;
            break;
          }
          obj = obj.parent;
        }
        if (!closestEnemyHit || intersects[0].distance < closestEnemyHit.dist) {
          closestEnemyHit = {
            enemy,
            dist: intersects[0].distance,
            hitbox: zone,
            point: intersects[0].point.clone(),
          };
        }
        continue;
      }

      // Generous capsule fallback so fast shots still feel responsive
      const enemyEyePos = new THREE.Vector3(enemy.mesh.position.x, enemy.mesh.position.y + 1.6, enemy.mesh.position.z);
      const enemyBodyPos = new THREE.Vector3(enemy.mesh.position.x, enemy.mesh.position.y + 1.05, enemy.mesh.position.z);
      const enemyLegPos = new THREE.Vector3(enemy.mesh.position.x, enemy.mesh.position.y + 0.45, enemy.mesh.position.z);

      const dEye = raycaster.ray.distanceToPoint(enemyEyePos);
      const dBody = raycaster.ray.distanceToPoint(enemyBodyPos);
      const dLeg = raycaster.ray.distanceToPoint(enemyLegPos);

      if (dEye < 0.3) {
        if (!closestEnemyHit || distFromPlayer < closestEnemyHit.dist) {
          closestEnemyHit = { enemy, dist: distFromPlayer, hitbox: 'head', point: enemyEyePos };
        }
      } else if (dBody < 0.5) {
        if (!closestEnemyHit || distFromPlayer < closestEnemyHit.dist) {
          closestEnemyHit = { enemy, dist: distFromPlayer, hitbox: 'torso', point: enemyBodyPos };
        }
      } else if (dLeg < 0.42) {
        if (!closestEnemyHit || distFromPlayer < closestEnemyHit.dist) {
          closestEnemyHit = { enemy, dist: distFromPlayer, hitbox: 'leg', point: enemyLegPos };
        }
      }
    }

    let finalHitPoint = obstacleHitPoint ?? rayOrigin.clone().add(shootDir.clone().multiplyScalar(weapon.range));

    // Resolve Hit
    if (closestEnemyHit) {
      const e = closestEnemyHit.enemy;
      const isHeadshot = closestEnemyHit.hitbox === 'head';
      const mult =
        closestEnemyHit.hitbox === 'head'
          ? 2.5
          : closestEnemyHit.hitbox === 'arm'
          ? 0.75
          : closestEnemyHit.hitbox === 'leg'
          ? 0.7
          : 1.0;

      const dmg = Math.round(weapon.damage * mult);
      e.data.health -= dmg;
      this.ctx.stats.shotsHit++;
      if (isHeadshot) this.ctx.stats.headshots++;

      this.ctx.feedback.hitMarkerTimer = 0.22;
      this.ctx.feedback.isHeadshotHit = isHeadshot;
      soundManager.playHitMarker();
      soundManager.playFleshHit();

      if (closestEnemyHit.hitbox === 'leg' && e.data.health > 0) {
        this.ctx.systems.ai.staggerEnemy?.(e, 0.75);
      }

      finalHitPoint = closestEnemyHit.point;
      this.ctx.events.emit('enemyDamaged', { enemy: e, amount: dmg, headshot: isHeadshot });

      if (e.data.health <= 0) {
        this.ctx.systems.ai.killEnemy(e, isHeadshot);
      } else {
        e.data.alertState = 'combat';
        e.data.suspicionMeter = 100;
        e.data.lastKnownPlayerPos = [this.ctx.player.pos.x, this.ctx.player.pos.y, this.ctx.player.pos.z];
        this.ctx.events.emit('noise', { origin: e.mesh.position.clone(), radius: 25, kind: 'voice' });
      }
    } else if (barrelHit) {
      barrelHit.barrel.health -= weapon.damage;
      this.ctx.systems.vfx.createHitSparks(finalHitPoint);
      soundManager.playMetalRicochet();
      if (barrelHit.barrel.health <= 0) {
        this.explodeBarrel(barrelHit.barrel);
      }
    } else if (cameraHit) {
      cameraHit.isDestroyed = true;
      cameraHit.lightCone.visible = false;
      cameraHit.light.intensity = 0;
      this.ctx.systems.vfx.createHitSparks(finalHitPoint);
      soundManager.playMetalRicochet();
    } else if (crateHit) {
      this.damageBreakableProp(crateHit.prop, weapon.damage, crateHit.point);
    } else if (obstacleHitPoint) {
      this.ctx.systems.vfx.createHitSparks(finalHitPoint);
      this.ctx.systems.vfx.createBulletDecal(finalHitPoint, obstacleNormal);
      soundManager.playMetalRicochet();
    }

    if (weapon.id !== 'knife') {
      this.ctx.systems.vfx.createBulletTracer(physicalMuzzle, finalHitPoint);
    }
  }

  public triggerExplosionAt(position: THREE.Vector3, radius: number, maxDamage: number) {
    soundManager.playExplosion();

    this.ctx.events.emit('explosion', {
      position: position.clone(),
      radius,
      damage: maxDamage,
    });

    // Player splash damage
    const distToPlayer = this.ctx.player.pos.distanceTo(position);
    if (distToPlayer < radius * 0.85) {
      this.ctx.systems.player.damage((1 - distToPlayer / (radius * 0.85)) * (maxDamage * 0.55), position);
    }

    // Enemy splash damage
    for (const enemy of this.ctx.enemies) {
      if (enemy.isDead) continue;
      const d = enemy.mesh.position.distanceTo(position);
      if (d < radius) {
        enemy.data.health -= (1 - d / radius) * maxDamage;
        if (enemy.data.health <= 0) {
          this.ctx.systems.ai.killEnemy(enemy, false);
        } else {
          this.ctx.systems.ai.staggerEnemy?.(enemy, 1.0);
          enemy.data.alertState = 'combat';
          enemy.data.suspicionMeter = 100;
        }
      }
    }

    // Shatter nearby breakable glass / crates
    const breakables = this.ctx.mapData.breakableProps ?? [];
    for (const prop of breakables) {
      if (prop.isBroken) continue;
      const center = new THREE.Vector3();
      prop.box.getCenter(center);
      if (center.distanceTo(position) < radius) {
        this.damageBreakableProp(prop, maxDamage, center);
      }
    }

    // Chain-detonate nearby explosive barrels
    for (const barrel of this.ctx.mapData.explosiveBarrels) {
      if (barrel.isExploded) continue;
      if (barrel.position.distanceTo(position) < radius * 0.75) {
        barrel.isExploded = true;
        this.ctx.scene.remove(barrel.mesh);
        setTimeout(() => {
          this.triggerExplosionAt(barrel.position, 10, 120);
        }, 90);
      }
    }

    this.ctx.events.emit('noise', { origin: position.clone(), radius: 65, kind: 'explosion' });
  }

  public explodeBarrel(barrel: ExplosiveBarrel) {
    if (barrel.isExploded) return;
    barrel.isExploded = true;
    this.ctx.scene.remove(barrel.mesh);
    this.triggerExplosionAt(barrel.position, 10, 120);
  }

  private updateProjectiles(dt: number) {
    // 1. Frag Grenades
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuseTimer -= dt;
      g.vel.y -= 16.5 * dt;

      const nextPos = g.pos.clone().addScaledVector(g.vel, dt);
      if (nextPos.y <= 0.14) {
        nextPos.y = 0.14;
        g.vel.y = Math.abs(g.vel.y) * 0.42;
        g.vel.x *= 0.72;
        g.vel.z *= 0.72;
      }

      if (this.ctx.physics.containsPoint(nextPos)) {
        g.vel.x *= -0.5;
        g.vel.z *= -0.5;
      } else {
        g.pos.copy(nextPos);
      }

      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 6;
      g.mesh.rotation.z += dt * 4;

      if (g.fuseTimer <= 0) {
        this.ctx.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
        this.triggerExplosionAt(g.pos, 9.5, 145);
      }
    }

    // 2. RPG-7 Rockets
    for (let i = this.activeRockets.length - 1; i >= 0; i--) {
      const r = this.activeRockets[i];
      r.age += dt;
      const stepDist = r.vel.length() * dt;
      const dir = r.vel.clone().normalize();
      const hit = this.ctx.physics.raycast(r.pos, dir, stepDist + 0.35);

      let hitEnemy = false;
      for (const e of this.ctx.enemies) {
        if (e.isDead) continue;
        if (e.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)).distanceTo(r.pos) < 1.1) {
          hitEnemy = true;
          break;
        }
      }

      if (hit || hitEnemy || r.pos.y <= 0.1 || r.age > 4.0) {
        const explodePos = hit ? hit.point : r.pos.clone();
        this.ctx.scene.remove(r.mesh);
        this.activeRockets.splice(i, 1);
        this.triggerExplosionAt(explodePos, 11.5, 185);
      } else {
        r.pos.addScaledVector(r.vel, dt);
        r.mesh.position.copy(r.pos);
      }
    }
  }

  public update(dt: number) {
    this.updateProjectiles(dt);

    // Cooldowns & Reload
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

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

    // Auto fire & burst decay
    const input = this.ctx.systems.input.getActions();
    this.ctx.player.isAiming = input.aim && !this.ctx.player.isBinoculars;

    if (input.fire && this.weapons[this.currentWeaponIdx].isAutomatic) {
      this.triggerFire();
    } else if (!input.fire) {
      this.burstShotIndex = Math.max(0, this.burstShotIndex - dt * 15);
    }

    // Decay weapon kick
    this.weaponKickZ = Math.max(0, this.weaponKickZ - dt * 0.26);
    this.weaponKickPitch = Math.max(0, this.weaponKickPitch - dt * 0.55);

    // Update weapon position, ADS breathing sway, and bobbing
    if (this.currentWeaponMesh) {
      const swayScale = this.ctx.player.isCrouching ? 0.5 : 1.0;
      const breathX = Math.sin(this.ctx.time * 1.6) * 0.0022 * swayScale;
      const breathY = Math.cos(this.ctx.time * 3.2) * 0.0018 * swayScale;

      if (this.ctx.player.isAiming) {
        this.currentWeaponMesh.position.set(breathX, -0.14 + breathY, -0.32 + this.weaponKickZ);
        this.currentWeaponMesh.rotation.set(this.weaponKickPitch, 0, 0);
      } else {
        const bobX = Math.cos(this.ctx.player.bobTimer * 0.5) * 0.012;
        const bobY = Math.abs(Math.sin(this.ctx.player.bobTimer)) * 0.015;
        this.currentWeaponMesh.position.set(
          0.18 + bobX + breathX,
          -0.22 - bobY + breathY,
          -0.42 + this.weaponKickZ
        );
        this.currentWeaponMesh.rotation.set(this.weaponKickPitch, 0, 0);
      }
    }
  }

  public dispose() {
    this.ctx.camera.remove(this.weaponMeshGroup);
    this.ctx.camera.remove(this.muzzleFlashLight);
    for (const g of this.activeGrenades) this.ctx.scene.remove(g.mesh);
    for (const r of this.activeRockets) this.ctx.scene.remove(r.mesh);
    for (const c of this.plantedC4List) this.ctx.scene.remove(c.mesh);
  }
}
