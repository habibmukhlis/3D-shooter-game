import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/GameContext';
import { SkyDome } from '../render/SkyDome';
import { WeatherSystem } from '../render/WeatherSystem';

export class WorldSystem implements GameSystem {
  private ctx: GameContext;
  private hemiLight?: THREE.HemisphereLight;
  private skyDome?: SkyDome;
  private weatherSystem?: WeatherSystem;
  private baseSunOffset = new THREE.Vector3(40, 80, 50);
  private baseSunIntensity = 0.95;
  private baseHemiIntensity = 0.6;
  private shadowRecenterCounter = 0;
  private isPowerCut = false;
  private originalLightIntensities = new WeakMap<THREE.Light, number>();

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.setupEnvironmentLighting();
    this.applyShadowSettings();

    this.skyDome = new SkyDome(this.ctx.scene, this.ctx.missionDef.environment);
    this.weatherSystem = new WeatherSystem(this.ctx.scene, this.ctx.missionDef.environment);

    this.ctx.events.on('objectiveCompleted', ({ id }) => {
      if (id === 'obj_power_grid' || id === 'obj_generator' || id === 'obj_bunker_breach') {
        this.setPowerCut(true);
      }
    });
  }

  private getBaseExposure(): number {
    const env = this.ctx.missionDef.environment;
    const postBoost = this.ctx.settings.postProcessing ? 1.0 : 0.9;
    if (env === 'daylight_radar') return 1.2 * postBoost;
    if (env === 'mountain_dawn') return 1.15 * postBoost;
    if (env === 'harbor_storm') return 1.08 * postBoost;
    return 1.15 * postBoost;
  }

  private applyToneMapping(isNVG: boolean) {
    const renderer = this.ctx.renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isNVG ? 1.5 : this.getBaseExposure();
  }

  public setupEnvironmentLighting() {
    const env = this.ctx.missionDef.environment;
    const scene = this.ctx.scene;

    this.applyToneMapping(false);

    if (env === 'daylight_radar') {
      scene.background = new THREE.Color(0xdbeafe);
      scene.fog = new THREE.Fog(0xdbeafe, 55, 230);

      this.ctx.ambientLight = new THREE.AmbientLight(0xfff7ed, 1.35);
      scene.add(this.ctx.ambientLight);

      this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xd6b485, 0.85);
      this.baseHemiIntensity = 0.85;
      scene.add(this.hemiLight);

      this.baseSunIntensity = 2.6;
      this.baseSunOffset.set(50, 120, 40);
      this.ctx.sunOrMoonLight = new THREE.DirectionalLight(0xfef08a, this.baseSunIntensity);
      this.ctx.sunOrMoonLight.position.copy(this.baseSunOffset);
      this.ctx.sunOrMoonLight.castShadow = this.ctx.settings.shadowQuality !== 'off';
    } else if (env === 'mountain_dawn') {
      scene.background = new THREE.Color(0x334155);
      scene.fog = new THREE.FogExp2(0x334155, 0.0125);

      this.ctx.ambientLight = new THREE.AmbientLight(0x475569, 1.1);
      scene.add(this.ctx.ambientLight);

      this.hemiLight = new THREE.HemisphereLight(0xfdba74, 0x334155, 0.75);
      this.baseHemiIntensity = 0.75;
      scene.add(this.hemiLight);

      this.baseSunIntensity = 2.2;
      this.baseSunOffset.set(80, 35, -45);
      this.ctx.sunOrMoonLight = new THREE.DirectionalLight(0xfdba74, this.baseSunIntensity);
      this.ctx.sunOrMoonLight.position.copy(this.baseSunOffset);
      this.ctx.sunOrMoonLight.castShadow = this.ctx.settings.shadowQuality !== 'off';
    } else if (env === 'harbor_storm') {
      scene.background = new THREE.Color(0x070b12);
      scene.fog = new THREE.FogExp2(0x0b121b, 0.014);

      this.ctx.ambientLight = new THREE.AmbientLight(0x1e293b, 0.75);
      scene.add(this.ctx.ambientLight);

      this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.65);
      this.baseHemiIntensity = 0.65;
      scene.add(this.hemiLight);

      this.baseSunIntensity = 0.85;
      this.baseSunOffset.set(-45, 85, -35);
      this.ctx.sunOrMoonLight = new THREE.DirectionalLight(0x64748b, this.baseSunIntensity);
      this.ctx.sunOrMoonLight.position.copy(this.baseSunOffset);
      this.ctx.sunOrMoonLight.castShadow = this.ctx.settings.shadowQuality !== 'off';
    } else {
      // night_depot default
      scene.background = new THREE.Color(0x0a0e14);
      scene.fog = new THREE.FogExp2(0x0c1119, 0.0115);

      this.ctx.ambientLight = new THREE.AmbientLight(0x27364d, 0.85);
      scene.add(this.ctx.ambientLight);

      this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x111827, 0.6);
      this.baseHemiIntensity = 0.6;
      scene.add(this.hemiLight);

      this.baseSunIntensity = 0.95;
      this.baseSunOffset.set(40, 80, 50);
      this.ctx.sunOrMoonLight = new THREE.DirectionalLight(0x7dd3fc, this.baseSunIntensity);
      this.ctx.sunOrMoonLight.position.copy(this.baseSunOffset);
      this.ctx.sunOrMoonLight.castShadow = this.ctx.settings.shadowQuality !== 'off';
    }

    if (this.ctx.sunOrMoonLight) {
      const shadowMapSize = this.ctx.settings.shadowQuality === 'high' ? 2048 : 1024;
      this.ctx.sunOrMoonLight.shadow.mapSize.width = shadowMapSize;
      this.ctx.sunOrMoonLight.shadow.mapSize.height = shadowMapSize;
      this.ctx.sunOrMoonLight.shadow.bias = -0.0004;
      this.ctx.sunOrMoonLight.shadow.normalBias = 0.02;
      this.ctx.sunOrMoonLight.shadow.camera.near = 10;
      this.ctx.sunOrMoonLight.shadow.camera.far = 220;
      this.ctx.sunOrMoonLight.shadow.camera.left = -65;
      this.ctx.sunOrMoonLight.shadow.camera.right = 65;
      this.ctx.sunOrMoonLight.shadow.camera.top = 65;
      this.ctx.sunOrMoonLight.shadow.camera.bottom = -65;
      this.ctx.sunOrMoonLight.shadow.camera.updateProjectionMatrix();
      scene.add(this.ctx.sunOrMoonLight);
      scene.add(this.ctx.sunOrMoonLight.target);
    }
  }

  public applyShadowSettings() {
    const renderer = this.ctx.renderer;
    this.applyToneMapping(this.ctx.player?.isNightVision ?? false);

    if (this.ctx.settings.shadowQuality === 'off') {
      renderer.shadowMap.enabled = false;
      if (this.ctx.sunOrMoonLight) this.ctx.sunOrMoonLight.castShadow = false;
    } else {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type =
        this.ctx.settings.shadowQuality === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      if (this.ctx.sunOrMoonLight) {
        this.ctx.sunOrMoonLight.castShadow = true;
        const desiredSize = this.ctx.settings.shadowQuality === 'high' ? 2048 : 1024;
        if (this.ctx.sunOrMoonLight.shadow.mapSize.width !== desiredSize) {
          this.ctx.sunOrMoonLight.shadow.mapSize.set(desiredSize, desiredSize);
          if (this.ctx.sunOrMoonLight.shadow.map) {
            this.ctx.sunOrMoonLight.shadow.map.dispose();
            this.ctx.sunOrMoonLight.shadow.map = null;
          }
        }
      }
    }
    renderer.shadowMap.needsUpdate = true;
  }

  public applyNightVisionLighting(isNVG: boolean) {
    if (!this.ctx.ambientLight) return;
    this.applyToneMapping(isNVG);

    if (isNVG) {
      this.ctx.ambientLight.intensity = 2.4;
      this.ctx.ambientLight.color.setHex(0x10b981);
      if (this.hemiLight) {
        this.hemiLight.intensity = 1.1;
      }
    } else {
      const env = this.ctx.missionDef.environment;
      if (env === 'daylight_radar') {
        this.ctx.ambientLight.intensity = 1.35;
        this.ctx.ambientLight.color.setHex(0xfff7ed);
      } else if (env === 'mountain_dawn') {
        this.ctx.ambientLight.intensity = 1.1;
        this.ctx.ambientLight.color.setHex(0x475569);
      } else if (env === 'harbor_storm') {
        this.ctx.ambientLight.intensity = 0.75;
        this.ctx.ambientLight.color.setHex(0x1e293b);
      } else {
        this.ctx.ambientLight.intensity = 0.85;
        this.ctx.ambientLight.color.setHex(0x27364d);
      }
      if (this.hemiLight) {
        this.hemiLight.intensity = this.baseHemiIntensity;
      }
    }
  }

  public setPowerCut(cut: boolean) {
    this.isPowerCut = cut;
    const factor = cut ? 0.15 : 1.0;
    const mapData = this.ctx.mapData as
      | (typeof this.ctx.mapData & { compoundLights?: THREE.Light[]; powerCut?: boolean })
      | undefined;
    if (!mapData) return;

    mapData.powerCut = cut;

    if (Array.isArray(mapData.compoundLights)) {
      for (const light of mapData.compoundLights) {
        if (!this.originalLightIntensities.has(light)) {
          this.originalLightIntensities.set(light, light.intensity);
        }
        const baseIntensity = this.originalLightIntensities.get(light) ?? light.intensity;
        light.intensity = baseIntensity * factor;
      }
    }

    for (const spot of mapData.spotlights) {
      if (!this.originalLightIntensities.has(spot.light)) {
        this.originalLightIntensities.set(spot.light, spot.light.intensity);
      }
      const baseIntensity = this.originalLightIntensities.get(spot.light) ?? spot.light.intensity;
      spot.light.intensity = baseIntensity * factor;
    }
  }

  public update(dt: number) {
    const playerPos = this.ctx.player.pos;

    if (this.skyDome) {
      this.skyDome.update(dt, playerPos);

      if (this.ctx.missionDef.environment === 'harbor_storm' && !this.ctx.player.isNightVision) {
        const flash = this.skyDome.getLightningFlash();
        if (this.ctx.sunOrMoonLight) {
          this.ctx.sunOrMoonLight.intensity = this.baseSunIntensity + flash * 1.65;
        }
        if (this.hemiLight) {
          this.hemiLight.intensity = this.baseHemiIntensity + flash * 0.95;
        }
      }
    }

    if (this.weatherSystem) {
      this.weatherSystem.update(dt, this.ctx.camera.position);
    }

    this.updateShadowFrustumCenter(playerPos);
    this.updateSurveillanceCameras();
    this.updateSpotlights(dt);
    this.updateExtractionHelicopter(dt);
  }

  private updateShadowFrustumCenter(playerPos: THREE.Vector3) {
    this.shadowRecenterCounter = (this.shadowRecenterCounter + 1) % 4;
    if (this.shadowRecenterCounter !== 0) return;

    const sun = this.ctx.sunOrMoonLight;
    if (!sun || !sun.castShadow) return;

    const snapX = Math.round(playerPos.x);
    const snapZ = Math.round(playerPos.z);

    sun.position.set(
      snapX + this.baseSunOffset.x,
      this.baseSunOffset.y,
      snapZ + this.baseSunOffset.z
    );
    sun.target.position.set(snapX, 0, snapZ);
    sun.target.updateMatrixWorld();
  }

  private updateSurveillanceCameras() {
    if (!this.ctx.mapData) return;
    const playerPos = this.ctx.player.pos;

    for (const cam of this.ctx.mapData.cameras) {
      if (cam.isDestroyed) continue;
      const angle = cam.baseAngle + Math.sin(Date.now() * 0.001) * (cam.sweepRange / 2);
      cam.head.rotation.y = angle;

      if (!this.ctx.alarm.active) {
        const camPos = cam.mount.position;
        const d = camPos.distanceTo(playerPos);
        if (d < 18) {
          const toPlayer = playerPos.clone().sub(camPos).normalize();
          const camForward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, angle, 0));
          if (camForward.dot(toPlayer) > 0.7) {
            this.ctx.events.emit('alarm', { source: cam.id });
          }
        }
      }
    }
  }

  private updateSpotlights(dt: number) {
    if (!this.ctx.mapData) return;
    const playerPos = this.ctx.player.pos;

    for (const spot of this.ctx.mapData.spotlights) {
      spot.baseAngle += dt * spot.sweepSpeed;
      const radius = 22;
      spot.target.position.x = spot.light.position.x + Math.cos(spot.baseAngle) * radius;
      spot.target.position.z = spot.light.position.z + Math.sin(spot.baseAngle) * radius;

      if (!this.ctx.alarm.active && !this.isPowerCut) {
        const d = playerPos.distanceTo(spot.target.position);
        if (d < 4.5 && playerPos.y < 3) {
          this.ctx.events.emit('alarm', { source: 'spotlight' });
        }
      }
    }
  }

  private updateExtractionHelicopter(dt: number) {
    const heli = this.ctx.mapData?.extractionHeli;
    if (!heli) return;

    const primaryDone = this.ctx.objectives
      .filter((o) => !o.isOptional && o.id !== 'obj_extract')
      .every((o) => o.isCompleted);

    const isExtracting = this.ctx.extraction.isExtracting;
    const rotorSpeed = isExtracting ? 28 : primaryDone ? 18 : 3.5;
    heli.rotor.rotation.y += dt * rotorSpeed;
    heli.tailRotor.rotation.x += dt * (rotorSpeed * 1.35);

    if (isExtracting) {
      heli.group.position.y += dt * 4.2;
      heli.group.rotation.x = Math.max(-0.12, heli.group.rotation.x - dt * 0.1);
    } else if (primaryDone) {
      heli.group.position.y = heli.basePos.y + Math.sin(Date.now() * 0.006) * 0.08 + 0.12;
    }
  }

  public dispose() {
    this.skyDome?.dispose();
    this.weatherSystem?.dispose();
  }
}
