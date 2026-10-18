import * as THREE from 'three';
import type { EnvironmentType } from '../../types/game';

const BOX_X = 45;
const BOX_Y = 25;
const BOX_Z = 45;
const HALF_X = BOX_X * 0.5;
const HALF_Y = BOX_Y * 0.5;
const HALF_Z = BOX_Z * 0.5;

function wrapCoord(val: number, center: number, span: number, halfSpan: number): number {
  let rel = (val - center + halfSpan) % span;
  if (rel < 0) rel += span;
  return center - halfSpan + rel;
}

export class WeatherSystem {
  private scene: THREE.Scene;
  private environment: EnvironmentType;
  private mode: 'rain' | 'sand' | 'snow';
  private count: number;
  private elapsed = 0;

  // Particle state arrays: [x, y, z, speedFactor, phase]
  private particleData: Float32Array;
  private geometry: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private material: THREE.Material;
  private particleTex?: THREE.CanvasTexture;
  private renderObject: THREE.LineSegments | THREE.Points;

  private rainVel = new THREE.Vector3();
  private rainStreak = new THREE.Vector3();

  constructor(scene: THREE.Scene, environment: EnvironmentType) {
    this.scene = scene;
    this.environment = environment;

    if (environment === 'harbor_storm') {
      this.mode = 'rain';
      this.count = 1400;
      this.rainVel.set(-6.8, -29.0, -3.9);
      this.rainStreak.set(-0.26, -1.18, -0.15);
    } else if (environment === 'daylight_radar') {
      this.mode = 'sand';
      this.count = 500;
    } else if (environment === 'mountain_dawn') {
      this.mode = 'snow';
      this.count = 650;
    } else {
      // night_depot default
      this.mode = 'rain';
      this.count = 900;
      this.rainVel.set(-2.4, -24.5, -1.4);
      this.rainStreak.set(-0.1, -0.95, -0.06);
    }

    this.particleData = new Float32Array(this.count * 5);
    for (let i = 0; i < this.count; i++) {
      const idx = i * 5;
      this.particleData[idx] = (Math.random() - 0.5) * BOX_X;
      this.particleData[idx + 1] = (Math.random() - 0.5) * BOX_Y;
      this.particleData[idx + 2] = (Math.random() - 0.5) * BOX_Z;
      this.particleData[idx + 3] = 0.78 + Math.random() * 0.44;
      this.particleData[idx + 4] = Math.random() * Math.PI * 2;
    }

    this.geometry = new THREE.BufferGeometry();

    if (this.mode === 'rain') {
      // 2 vertices per rain streak (6 floats per particle)
      const vertexPositions = new Float32Array(this.count * 6);
      this.posAttr = new THREE.BufferAttribute(vertexPositions, 3);
      this.posAttr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('position', this.posAttr);

      const isStorm = environment === 'harbor_storm';
      this.material = new THREE.LineBasicMaterial({
        color: isStorm ? 0x94a3b8 : 0x7dd3fc,
        transparent: true,
        opacity: isStorm ? 0.42 : 0.32,
        depthWrite: false,
        fog: false,
      });

      this.renderObject = new THREE.LineSegments(this.geometry, this.material);
    } else {
      // 1 vertex per particle (3 floats per particle)
      const vertexPositions = new Float32Array(this.count * 3);
      this.posAttr = new THREE.BufferAttribute(vertexPositions, 3);
      this.posAttr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('position', this.posAttr);

      this.particleTex = this.createSoftParticleTexture();
      const isSnow = this.mode === 'snow';
      this.material = new THREE.PointsMaterial({
        map: this.particleTex,
        color: isSnow ? 0xf1f5f9 : 0xe2c792,
        size: isSnow ? 0.22 : 0.16,
        sizeAttenuation: true,
        transparent: true,
        opacity: isSnow ? 0.76 : 0.48,
        depthWrite: false,
        fog: false,
      });

      this.renderObject = new THREE.Points(this.geometry, this.material);
    }

    this.renderObject.name = `WeatherParticles_${this.environment}`;
    this.renderObject.frustumCulled = false;
    this.renderObject.renderOrder = 15;
    this.scene.add(this.renderObject);
  }

  private createSoftParticleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    return new THREE.CanvasTexture(canvas);
  }

  public update(dt: number, cameraPos: THREE.Vector3) {
    this.elapsed += dt;
    const cx = cameraPos.x;
    const cy = cameraPos.y;
    const cz = cameraPos.z;
    const positions = this.posAttr.array as Float32Array;

    if (this.mode === 'rain') {
      const vx = this.rainVel.x;
      const vy = this.rainVel.y;
      const vz = this.rainVel.z;
      const sx = this.rainStreak.x;
      const sy = this.rainStreak.y;
      const sz = this.rainStreak.z;

      for (let i = 0; i < this.count; i++) {
        const dIdx = i * 5;
        const speed = this.particleData[dIdx + 3];

        let x = this.particleData[dIdx] + vx * speed * dt;
        let y = this.particleData[dIdx + 1] + vy * speed * dt;
        let z = this.particleData[dIdx + 2] + vz * speed * dt;

        x = wrapCoord(x, cx, BOX_X, HALF_X);
        y = wrapCoord(y, cy, BOX_Y, HALF_Y);
        z = wrapCoord(z, cz, BOX_Z, HALF_Z);

        this.particleData[dIdx] = x;
        this.particleData[dIdx + 1] = y;
        this.particleData[dIdx + 2] = z;

        const vIdx = i * 6;
        positions[vIdx] = x;
        positions[vIdx + 1] = y;
        positions[vIdx + 2] = z;
        positions[vIdx + 3] = x + sx * speed;
        positions[vIdx + 4] = y + sy * speed;
        positions[vIdx + 5] = z + sz * speed;
      }
    } else if (this.mode === 'sand') {
      const t = this.elapsed;
      for (let i = 0; i < this.count; i++) {
        const dIdx = i * 5;
        const speed = this.particleData[dIdx + 3];
        const phase = this.particleData[dIdx + 4];

        const vx = (5.8 + Math.sin(t * 0.9 + phase) * 1.6) * speed;
        const vy = Math.sin(t * 2.1 + phase) * 0.45;
        const vz = (2.1 + Math.cos(t * 1.3 + phase) * 1.1) * speed;

        let x = wrapCoord(this.particleData[dIdx] + vx * dt, cx, BOX_X, HALF_X);
        let y = wrapCoord(this.particleData[dIdx + 1] + vy * dt, cy, BOX_Y, HALF_Y);
        let z = wrapCoord(this.particleData[dIdx + 2] + vz * dt, cz, BOX_Z, HALF_Z);

        this.particleData[dIdx] = x;
        this.particleData[dIdx + 1] = y;
        this.particleData[dIdx + 2] = z;

        const vIdx = i * 3;
        positions[vIdx] = x;
        positions[vIdx + 1] = y;
        positions[vIdx + 2] = z;
      }
    } else {
      // Swirling alpine snowflakes
      const t = this.elapsed;
      for (let i = 0; i < this.count; i++) {
        const dIdx = i * 5;
        const speed = this.particleData[dIdx + 3];
        const phase = this.particleData[dIdx + 4];

        const vx = 1.15 + Math.sin(t * 1.45 + phase) * 1.25;
        const vy = -1.65 * speed;
        const vz = -0.55 + Math.cos(t * 1.2 + phase) * 1.25;

        let x = wrapCoord(this.particleData[dIdx] + vx * dt, cx, BOX_X, HALF_X);
        let y = wrapCoord(this.particleData[dIdx + 1] + vy * dt, cy, BOX_Y, HALF_Y);
        let z = wrapCoord(this.particleData[dIdx + 2] + vz * dt, cz, BOX_Z, HALF_Z);

        this.particleData[dIdx] = x;
        this.particleData[dIdx + 1] = y;
        this.particleData[dIdx + 2] = z;

        const vIdx = i * 3;
        positions[vIdx] = x;
        positions[vIdx + 1] = y;
        positions[vIdx + 2] = z;
      }
    }

    this.posAttr.needsUpdate = true;
  }

  public dispose() {
    this.scene.remove(this.renderObject);
    this.geometry.dispose();
    this.material.dispose();
    if (this.particleTex) {
      this.particleTex.dispose();
    }
  }
}
