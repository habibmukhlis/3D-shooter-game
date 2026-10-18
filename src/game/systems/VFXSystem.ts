import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/GameContext';

interface TracerEntry {
  line: THREE.Line;
  age: number;
}

interface ShockwaveEntry {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

export class VFXSystem implements GameSystem {
  private ctx: GameContext;
  private bulletTracers: TracerEntry[] = [];
  private shockwaves: ShockwaveEntry[] = [];
  private bulletDecals: THREE.Mesh[] = [];

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    ctx.events.on('explosion', ({ position }) => {
      this.createExplosionVFX(position);
    });

    ctx.events.on('enemyDamaged', ({ enemy, headshot }) => {
      const bloodPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, headshot ? 1.6 : 1.1, 0));
      this.createBloodParticles(bloodPos);
    });
  }

  public update(dt: number) {
    // 1. Tracers
    for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
      const t = this.bulletTracers[i];
      t.age += dt;
      if (t.age > 0.08) {
        this.ctx.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.bulletTracers.splice(i, 1);
      }
    }

    // 2. Expanding explosion shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.age += dt;
      const t = s.age / s.maxAge;
      if (t >= 1) {
        this.ctx.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      } else {
        const scale = 1 + t * 9.5;
        s.mesh.scale.set(scale, scale, 1);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.75;
      }
    }

    // 3. Feedback timers
    if (this.ctx.feedback.hitMarkerTimer > 0) {
      this.ctx.feedback.hitMarkerTimer -= dt;
      if (this.ctx.feedback.hitMarkerTimer <= 0) {
        this.ctx.feedback.isHeadshotHit = false;
      }
    }
    if (this.ctx.feedback.damageDirectionTimer > 0) {
      this.ctx.feedback.damageDirectionTimer -= dt;
      if (this.ctx.feedback.damageDirectionTimer <= 0) {
        this.ctx.feedback.damageDirection = null;
      }
    }
  }

  public createBulletTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const mat = new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, mat);
    this.ctx.scene.add(line);
    this.bulletTracers.push({ line, age: 0 });
  }

  public createBulletDecal(pos: THREE.Vector3, normal?: THREE.Vector3) {
    if (this.bulletDecals.length > 35) {
      const old = this.bulletDecals.shift();
      if (old) {
        this.ctx.scene.remove(old);
        old.geometry.dispose();
        (old.material as THREE.Material).dispose();
      }
    }

    const decalGeo = new THREE.PlaneGeometry(0.14, 0.14);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0x18181b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.position.copy(pos);

    if (normal) {
      const lookTarget = pos.clone().add(normal);
      decal.lookAt(lookTarget);
      decal.position.addScaledVector(normal, 0.005);
    } else {
      decal.lookAt(this.ctx.camera.position);
    }

    this.ctx.scene.add(decal);
    this.bulletDecals.push(decal);
  }

  public createHitSparks(pos: THREE.Vector3) {
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(16 * 3);
    for (let i = 0; i < 16 * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 0.55;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xfef08a, size: 0.08 });
    const p = new THREE.Points(pGeo, pMat);
    p.position.copy(pos);
    this.ctx.scene.add(p);
    setTimeout(() => {
      this.ctx.scene.remove(p);
      pGeo.dispose();
      pMat.dispose();
    }, 120);
  }

  public createGlassShatter(pos: THREE.Vector3) {
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(28 * 3);
    for (let i = 0; i < 28 * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 1.6;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.14,
      transparent: true,
      opacity: 0.85,
    });
    const p = new THREE.Points(pGeo, pMat);
    p.position.copy(pos);
    this.ctx.scene.add(p);
    setTimeout(() => {
      this.ctx.scene.remove(p);
      pGeo.dispose();
      pMat.dispose();
    }, 320);
  }

  public createWoodSplinters(pos: THREE.Vector3) {
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(24 * 3);
    for (let i = 0; i < 24 * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 1.4;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x92400e,
      size: 0.15,
    });
    const p = new THREE.Points(pGeo, pMat);
    p.position.copy(pos);
    this.ctx.scene.add(p);
    setTimeout(() => {
      this.ctx.scene.remove(p);
      pGeo.dispose();
      pMat.dispose();
    }, 350);
  }

  public createBloodParticles(pos: THREE.Vector3) {
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(20 * 3);
    for (let i = 0; i < 20 * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 0.4;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x991b1b, size: 0.1 });
    const p = new THREE.Points(pGeo, pMat);
    p.position.copy(pos);
    this.ctx.scene.add(p);
    setTimeout(() => {
      this.ctx.scene.remove(p);
      pGeo.dispose();
      pMat.dispose();
    }, 200);
  }

  public createExplosionVFX(pos: THREE.Vector3) {
    const flash = new THREE.PointLight(0xf97316, 8, 28);
    flash.position.copy(pos);
    this.ctx.scene.add(flash);
    setTimeout(() => {
      this.ctx.scene.remove(flash);
      flash.dispose();
    }, 150);

    // Expanding ground shockwave ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.85, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, Math.max(0.08, pos.y - 0.3), pos.z);
    this.ctx.scene.add(ring);
    this.shockwaves.push({ mesh: ring, age: 0, maxAge: 0.38 });

    const particleCount = 45;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 4.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xf97316, size: 0.38 });
    const pSystem = new THREE.Points(geo, mat);
    pSystem.position.copy(pos);
    this.ctx.scene.add(pSystem);
    setTimeout(() => {
      this.ctx.scene.remove(pSystem);
      geo.dispose();
      mat.dispose();
    }, 480);
  }

  public dispose() {
    for (const t of this.bulletTracers) {
      this.ctx.scene.remove(t.line);
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    }
    this.bulletTracers = [];
    for (const s of this.shockwaves) {
      this.ctx.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    this.shockwaves = [];
    for (const d of this.bulletDecals) {
      this.ctx.scene.remove(d);
      d.geometry.dispose();
      (d.material as THREE.Material).dispose();
    }
    this.bulletDecals = [];
  }
}
