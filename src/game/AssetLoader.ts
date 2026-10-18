import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type ModelAssetKey =
  | 'watch_tower'
  | 'guard_tower'
  | 'shipping_container'
  | 'concrete_fences'
  | 'big_building'
  | 'military_outpost'
  | 'barrels'
  | 'cardboard_boxes'
  | 'military_crates'
  | 'military_truck'
  | 'blackhawk_heli'
  | 'assault_rifle'
  | 'first_aid_box'
  | 'pine_trees'
  | 'dead_trees'
  | 'rocks'
  | 'background_mountains';

export type TextureAssetKey =
  | 'concrete_wall_diff'
  | 'concrete_wall_rough'
  | 'walkway_diff'
  | 'walkway_norm'
  | 'walkway_rough'
  | 'trim_diff'
  | 'trim_norm'
  | 'trim_rough'
  | 'wood_plank_diff'
  | 'watchtower_diff'
  | 'watchtower_norm';

const MODEL_PATHS: Record<ModelAssetKey, string> = {
  watch_tower: '/assets/models/watch_tower.glb',
  guard_tower: '/assets/models/guard_tower.glb',
  shipping_container: '/assets/models/shipping_container.glb',
  concrete_fences: '/assets/models/concrete_fences.glb',
  big_building: '/assets/models/big_building.glb',
  military_outpost: '/assets/models/military_outpost.glb',
  barrels: '/assets/models/barrels.glb',
  cardboard_boxes: '/assets/models/cardboard_boxes.glb',
  military_crates: '/assets/models/military_crates.glb',
  military_truck: '/assets/models/military_truck.glb',
  blackhawk_heli: '/assets/models/blackhawk_heli.glb',
  assault_rifle: '/assets/models/assault_rifle.glb',
  first_aid_box: '/assets/models/first_aid_box.glb',
  pine_trees: '/assets/models/pine_trees.glb',
  dead_trees: '/assets/models/dead_trees.glb',
  rocks: '/assets/models/rocks.glb',
  background_mountains: '/assets/models/background_mountains.glb',
};

const TEXTURE_PATHS: Record<TextureAssetKey, { url: string; srgb: boolean }> = {
  concrete_wall_diff: { url: '/assets/textures/concrete_wall_diff.webp', srgb: true },
  concrete_wall_rough: { url: '/assets/textures/concrete_wall_rough.webp', srgb: false },
  walkway_diff: { url: '/assets/textures/walkway_diff.webp', srgb: true },
  walkway_norm: { url: '/assets/textures/walkway_norm.webp', srgb: false },
  walkway_rough: { url: '/assets/textures/walkway_rough.webp', srgb: false },
  trim_diff: { url: '/assets/textures/trim_diff.webp', srgb: true },
  trim_norm: { url: '/assets/textures/trim_norm.webp', srgb: false },
  trim_rough: { url: '/assets/textures/trim_rough.webp', srgb: false },
  wood_plank_diff: { url: '/assets/textures/wood_plank_diff.webp', srgb: true },
  watchtower_diff: { url: '/assets/textures/watchtower_diff.webp', srgb: true },
  watchtower_norm: { url: '/assets/textures/watchtower_norm.webp', srgb: false },
};

export interface CloneNormalizeOptions {
  targetSize?: [number, number, number];
  targetWidth?: number;
  targetHeight?: number;
  targetLength?: number;
  uniformScaleToHeight?: number;
  uniformScaleToMaxDim?: number;
  meshNameFilter?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  tintColor?: number;
}

export class AssetLoader {
  private static models: Map<ModelAssetKey, THREE.Group> = new Map();
  private static textures: Map<TextureAssetKey, THREE.Texture> = new Map();
  private static isLoaded = false;
  private static loadingPromise: Promise<void> | null = null;

  public static isPreloaded(): boolean {
    return this.isLoaded;
  }

  public static async preloadAll(onProgress?: (percent: number, label: string) => void): Promise<void> {
    if (this.isLoaded) {
      onProgress?.(100, 'ASSETS READY');
      return;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    THREE.Cache.enabled = true;

    this.loadingPromise = (async () => {
      const gltfLoader = new GLTFLoader();
      const texLoader = new THREE.TextureLoader();

      const modelEntries = Object.entries(MODEL_PATHS) as [ModelAssetKey, string][];
      const texEntries = Object.entries(TEXTURE_PATHS) as [TextureAssetKey, { url: string; srgb: boolean }][];
      const totalItems = modelEntries.length + texEntries.length;
      let completed = 0;

      const report = (itemName: string) => {
        completed++;
        const pct = Math.min(99, Math.round((completed / totalItems) * 100));
        onProgress?.(pct, `LOADING ASSET: ${itemName.toUpperCase()}`);
      };

      // Load PBR Textures concurrently
      await Promise.all(
        texEntries.map(async ([key, cfg]) => {
          try {
            const tex = await new Promise<THREE.Texture>((resolve, reject) => {
              texLoader.load(cfg.url, resolve, undefined, reject);
            });
            tex.colorSpace = cfg.srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.needsUpdate = true;
            this.textures.set(key, tex);
          } catch {
            // Procedural fallback will be used if a texture fails
          } finally {
            report(key);
          }
        })
      );

      // Load 3D GLB Models in batches of 4 to avoid main-thread spikes
      const batchSize = 4;
      for (let i = 0; i < modelEntries.length; i += batchSize) {
        const batch = modelEntries.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async ([key, url]) => {
            try {
              const gltf = await new Promise<GLTF>((resolve, reject) => {
                gltfLoader.load(url, resolve, undefined, reject);
              });
              if (gltf && gltf.scene) {
                this.models.set(key, gltf.scene);
              }
            } catch {
              // Procedural fallback will be used if model fails
            } finally {
              report(key);
            }
          })
        );
      }

      this.isLoaded = true;
      onProgress?.(100, 'TACTICAL ENVIRONMENT INITIALIZED');
    })();

    return this.loadingPromise;
  }

  public static hasModel(key: ModelAssetKey): boolean {
    return this.models.has(key);
  }

  public static getTexture(key: TextureAssetKey, repeatX = 1, repeatY = 1): THREE.Texture | null {
    const base = this.textures.get(key);
    if (!base) return null;
    if (repeatX === 1 && repeatY === 1) return base;
    const cloned = base.clone();
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(repeatX, repeatY);
    cloned.needsUpdate = true;
    return cloned;
  }

  /**
   * Clones a cached GLB model, optionally isolates a specific named sub-mesh,
   * normalizes its origin so X/Z is centered at (0,0) and bottom Y sits at 0,
   * and scales it to the requested world dimensions.
   */
  public static cloneNormalizedModel(
    key: ModelAssetKey,
    options: CloneNormalizeOptions = {}
  ): THREE.Group | null {
    const template = this.models.get(key);
    if (!template) return null;

    let sourceObj: THREE.Object3D = template;
    if (options.meshNameFilter) {
      const targetName = options.meshNameFilter.toLowerCase();
      let found: THREE.Object3D | null = null;
      template.traverse((child) => {
        if (!found && child.name && child.name.toLowerCase().includes(targetName)) {
          found = child;
        }
      });
      if (found) {
        sourceObj = found;
      }
    }

    const cloned = sourceObj.clone(true);
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    cloned.scale.set(1, 1, 1);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    if (box.isEmpty()) return null;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const wrapper = new THREE.Group();

    // Scale calculation
    let sx = 1;
    let sy = 1;
    let sz = 1;

    const targetHeight = options.targetHeight ?? options.uniformScaleToHeight;
    const targetMaxDim = options.targetWidth ?? options.targetLength ?? options.uniformScaleToMaxDim;

    if (options.targetSize) {
      sx = size.x > 0.0001 ? options.targetSize[0] / size.x : 1;
      sy = size.y > 0.0001 ? options.targetSize[1] / size.y : 1;
      sz = size.z > 0.0001 ? options.targetSize[2] / size.z : 1;
    } else if (targetHeight && size.y > 0.0001) {
      const s = targetHeight / size.y;
      sx = s;
      sy = s;
      sz = s;
    } else if (targetMaxDim) {
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0.0001) {
        const s = targetMaxDim / maxDim;
        sx = s;
        sy = s;
        sz = s;
      }
    }

    cloned.scale.set(sx, sy, sz);
    cloned.position.set(-center.x * sx, -box.min.y * sy, -center.z * sz);

    const castShadow = options.castShadow ?? true;
    const receiveShadow = options.receiveShadow ?? true;

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;

        if (options.tintColor !== undefined && mesh.material) {
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone() as THREE.MeshStandardMaterial;
          if (mat.color) {
            mat.color.lerp(new THREE.Color(options.tintColor), 0.35);
          }
          mesh.material = mat;
        }
      }
    });

    wrapper.add(cloned);
    return wrapper;
  }
}
