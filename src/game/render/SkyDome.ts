import * as THREE from 'three';
import type { EnvironmentType } from '../../types/game';

interface SkyPalette {
  zenith: string;
  upperMid: string;
  lowerMid: string;
  horizonBand: string;
  horizon: string;
  nadir: string;
  starCount: number;
  starMinY: number;
  starOpacity: number;
  celestialDir: [number, number, number];
  celestialSize: number;
  celestialCoreColor: string;
  celestialGlowColor: string;
  isCrescentMoon: boolean;
  hasStormClouds: boolean;
}

const SKY_PALETTES: Record<EnvironmentType, SkyPalette> = {
  night_depot: {
    zenith: '#03060c',
    upperMid: '#07101e',
    lowerMid: '#0c1a2e',
    horizonBand: '#102033',
    horizon: '#0c1119',
    nadir: '#06090e',
    starCount: 450,
    starMinY: 16,
    starOpacity: 0.92,
    celestialDir: [40, 80, 50],
    celestialSize: 42,
    celestialCoreColor: '#e0f2fe',
    celestialGlowColor: 'rgba(125, 211, 252, 0.38)',
    isCrescentMoon: true,
    hasStormClouds: false,
  },
  daylight_radar: {
    zenith: '#1d4ed8',
    upperMid: '#3b82f6',
    lowerMid: '#93c5fd',
    horizonBand: '#fef3c7',
    horizon: '#dbeafe',
    nadir: '#cbd5e1',
    starCount: 0,
    starMinY: 100,
    starOpacity: 0,
    celestialDir: [50, 120, 40],
    celestialSize: 64,
    celestialCoreColor: '#fef9c3',
    celestialGlowColor: 'rgba(253, 224, 71, 0.55)',
    isCrescentMoon: false,
    hasStormClouds: false,
  },
  mountain_dawn: {
    zenith: '#0f172a',
    upperMid: '#1e293b',
    lowerMid: '#475569',
    horizonBand: '#ea580c',
    horizon: '#fdba74',
    nadir: '#334155',
    starCount: 210,
    starMinY: 85,
    starOpacity: 0.48,
    celestialDir: [80, 35, -45],
    celestialSize: 70,
    celestialCoreColor: '#ffedd5',
    celestialGlowColor: 'rgba(251, 146, 60, 0.62)',
    isCrescentMoon: false,
    hasStormClouds: false,
  },
  harbor_storm: {
    zenith: '#05080f',
    upperMid: '#0d1522',
    lowerMid: '#162233',
    horizonBand: '#1e293b',
    horizon: '#0b121b',
    nadir: '#060a10',
    starCount: 0,
    starMinY: 120,
    starOpacity: 0,
    celestialDir: [-45, 85, -35],
    celestialSize: 52,
    celestialCoreColor: '#94a3b8',
    celestialGlowColor: 'rgba(148, 163, 184, 0.16)',
    isCrescentMoon: false,
    hasStormClouds: true,
  },
};

export class SkyDome {
  private scene: THREE.Scene;
  private environment: EnvironmentType;
  private group: THREE.Group;
  private domeMesh: THREE.Mesh;
  private domeMat: THREE.MeshBasicMaterial;
  private domeTexture: THREE.CanvasTexture;
  private stars?: THREE.Points;
  private starGeo?: THREE.BufferGeometry;
  private starMat?: THREE.PointsMaterial;
  private celestialMesh?: THREE.Mesh;
  private celestialGeo?: THREE.PlaneGeometry;
  private celestialMat?: THREE.MeshBasicMaterial;
  private celestialTex?: THREE.CanvasTexture;

  private baseDomeColor = new THREE.Color(0xffffff);
  private flashDomeColor = new THREE.Color(0xdbeafe);
  private lightningIntensity = 0;
  private nextLightningTimer = 5.5;
  private pulseSequenceTimer = 0;
  private isPulsing = false;

  constructor(scene: THREE.Scene, environment: EnvironmentType) {
    this.scene = scene;
    this.environment = environment;
    this.group = new THREE.Group();
    this.group.name = 'SkyDomeGroup';

    const palette = SKY_PALETTES[environment] ?? SKY_PALETTES.night_depot;

    // 1. Procedural Sky Sphere (BackSide)
    this.domeTexture = this.buildSkyGradientTexture(palette);
    const domeGeo = new THREE.SphereGeometry(310, 24, 16);
    this.domeMat = new THREE.MeshBasicMaterial({
      map: this.domeTexture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.domeMesh = new THREE.Mesh(domeGeo, this.domeMat);
    this.domeMesh.renderOrder = -20;
    this.domeMesh.frustumCulled = false;
    this.group.add(this.domeMesh);

    // 2. Starfield (night_depot & mountain_dawn)
    if (palette.starCount > 0) {
      this.createStarfield(palette.starCount, palette.starMinY, palette.starOpacity);
    }

    // 3. Celestial Disc (Crescent Moon or Sun with atmospheric halo)
    if (!palette.hasStormClouds) {
      this.createCelestialBody(palette);
    }

    this.scene.add(this.group);
  }

  private buildSkyGradientTexture(palette: SkyPalette): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0.0, palette.zenith);
      grad.addColorStop(0.24, palette.upperMid);
      grad.addColorStop(0.41, palette.lowerMid);
      grad.addColorStop(0.475, palette.horizonBand);
      grad.addColorStop(0.51, palette.horizon);
      grad.addColorStop(1.0, palette.nadir);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle procedural storm cloud bands for harbor_storm
      if (palette.hasStormClouds) {
        let seed = 1337;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        for (let i = 0; i < 65; i++) {
          const cx = rand() * canvas.width;
          const cy = 40 + rand() * 205;
          const rx = 28 + rand() * 64;
          const ry = 6 + rand() * 16;

          const cloudGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
          const shade = i % 2 === 0 ? 'rgba(30, 41, 59, 0.34)' : 'rgba(15, 23, 42, 0.42)';
          cloudGrad.addColorStop(0, shade);
          cloudGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, ry / rx);
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.restore();
          ctx.fillStyle = cloudGrad;
          ctx.fill();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  private createStarfield(count: number, minY: number, opacity: number) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    let seed = 42091;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const radius = 294;
    let placed = 0;
    while (placed < count) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - v * 0.88);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      if (y < minY) continue;

      const idx = placed * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      const brightness = 0.55 + rand() * 0.45;
      const tint = rand();
      if (tint < 0.35) {
        // Cool ice-blue star
        colors[idx] = brightness * 0.78;
        colors[idx + 1] = brightness * 0.91;
        colors[idx + 2] = brightness;
      } else if (tint < 0.75) {
        // Pure crisp white star
        colors[idx] = brightness;
        colors[idx + 1] = brightness;
        colors[idx + 2] = brightness;
      } else {
        // Warm amber-white star
        colors[idx] = brightness;
        colors[idx + 1] = brightness * 0.92;
        colors[idx + 2] = brightness * 0.78;
      }

      placed++;
    }

    this.starGeo = new THREE.BufferGeometry();
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.starMat = new THREE.PointsMaterial({
      size: 1.8,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: false,
    });

    this.stars = new THREE.Points(this.starGeo, this.starMat);
    this.stars.renderOrder = -15;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  private createCelestialBody(palette: SkyPalette) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const center = 128;

    if (ctx) {
      // Outer atmospheric halo
      const halo = ctx.createRadialGradient(center, center, 10, center, center, 122);
      halo.addColorStop(0.0, palette.celestialCoreColor);
      halo.addColorStop(0.24, palette.celestialGlowColor);
      halo.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, 256, 256);

      // Crisp inner solar/lunar disc
      ctx.beginPath();
      ctx.arc(center, center, 28, 0, Math.PI * 2);
      ctx.fillStyle = palette.celestialCoreColor;
      ctx.fill();

      if (palette.isCrescentMoon) {
        // Carve subtle earthshine shadow to form a pale crescent moon
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(center + 13, center - 7, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    this.celestialTex = new THREE.CanvasTexture(canvas);
    this.celestialGeo = new THREE.PlaneGeometry(palette.celestialSize, palette.celestialSize);
    this.celestialMat = new THREE.MeshBasicMaterial({
      map: this.celestialTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.celestialMesh = new THREE.Mesh(this.celestialGeo, this.celestialMat);
    const dir = new THREE.Vector3(
      palette.celestialDir[0],
      palette.celestialDir[1],
      palette.celestialDir[2]
    )
      .normalize()
      .multiplyScalar(285);
    this.celestialMesh.position.copy(dir);
    this.celestialMesh.lookAt(0, 0, 0);
    this.celestialMesh.renderOrder = -12;
    this.celestialMesh.frustumCulled = false;

    this.group.add(this.celestialMesh);
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    this.group.position.set(playerPos.x, 0, playerPos.z);

    if (this.environment === 'harbor_storm') {
      this.updateStormLightning(dt);
    }
  }

  private updateStormLightning(dt: number) {
    if (!this.isPulsing) {
      this.nextLightningTimer -= dt;
      if (this.nextLightningTimer <= 0) {
        this.isPulsing = true;
        this.pulseSequenceTimer = 0;
        this.nextLightningTimer = 5.0 + Math.random() * 6.5;
      }
      this.lightningIntensity = 0;
    } else {
      this.pulseSequenceTimer += dt;
      const t = this.pulseSequenceTimer;
      // Double-strike sheet lightning envelope
      if (t < 0.06) {
        this.lightningIntensity = t / 0.06;
      } else if (t < 0.14) {
        this.lightningIntensity = 1.0 - (t - 0.06) / 0.08;
      } else if (t < 0.21) {
        this.lightningIntensity = ((t - 0.14) / 0.07) * 0.65;
      } else if (t < 0.42) {
        this.lightningIntensity = 0.65 * (1.0 - (t - 0.21) / 0.21);
      } else {
        this.lightningIntensity = 0;
        this.isPulsing = false;
      }
    }

    this.domeMat.color.lerpColors(
      this.baseDomeColor,
      this.flashDomeColor,
      this.lightningIntensity * 0.55
    );
    if (this.lightningIntensity > 0.01) {
      const boost = 1 + this.lightningIntensity * 0.85;
      this.domeMat.color.setRGB(boost, boost, boost * 1.08);
    } else {
      this.domeMat.color.setHex(0xffffff);
    }
  }

  public getLightningFlash(): number {
    return this.lightningIntensity;
  }

  public dispose() {
    this.scene.remove(this.group);
    this.domeMesh.geometry.dispose();
    this.domeMat.dispose();
    this.domeTexture.dispose();

    if (this.starGeo) this.starGeo.dispose();
    if (this.starMat) this.starMat.dispose();
    if (this.celestialGeo) this.celestialGeo.dispose();
    if (this.celestialMat) this.celestialMat.dispose();
    if (this.celestialTex) this.celestialTex.dispose();
  }
}
