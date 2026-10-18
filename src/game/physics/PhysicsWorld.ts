import * as THREE from 'three';

export type SurfaceMaterial = 'concrete' | 'metal' | 'wood' | 'dirt' | 'glass' | 'sandbag' | 'rock' | 'generic';

export interface ColliderEntry {
  id: number;
  box: THREE.Box3;
  enabled: boolean;
  material: SurfaceMaterial;
  /** Optional semantic tag, e.g. 'door', 'wall', 'prop'. */
  tag?: string;
  /** Arbitrary owner data (door instance, prop, etc.). */
  userData?: unknown;
  /** Internal de-duplication stamp for multi-cell queries. */
  stamp: number;
  /** Grid cell keys this entry is registered in. */
  cellKeys: number[];
}

export interface RaycastHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: ColliderEntry;
}

export interface RaycastOptions {
  /** Ignore colliders matching this predicate. */
  ignore?: (entry: ColliderEntry) => boolean;
}

const KEY_OFFSET = 32768;

/**
 * Uniform 2D (X/Z) spatial hash grid of axis-aligned colliders.
 * Replaces the previous O(N) linear scans for movement, line-of-sight and hitscan queries.
 */
export class PhysicsWorld {
  public readonly cellSize: number;
  private cells = new Map<number, ColliderEntry[]>();
  private entries: ColliderEntry[] = [];
  private stampCounter = 0;
  private nextId = 1;

  // Scratch objects (avoid per-query allocations)
  private readonly ray = new THREE.Ray();
  private readonly tmpHit = new THREE.Vector3();

  constructor(cellSize = 4) {
    this.cellSize = cellSize;
  }

  public get count(): number {
    return this.entries.length;
  }

  public all(): readonly ColliderEntry[] {
    return this.entries;
  }

  private key(cx: number, cz: number): number {
    return (cx + KEY_OFFSET) * 65536 + (cz + KEY_OFFSET);
  }

  private cellCoord(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  public add(box: THREE.Box3, material: SurfaceMaterial = 'generic', tag?: string, userData?: unknown): ColliderEntry {
    const entry: ColliderEntry = {
      id: this.nextId++,
      box: box.clone(),
      enabled: true,
      material,
      tag,
      userData,
      stamp: 0,
      cellKeys: [],
    };
    this.insert(entry);
    this.entries.push(entry);
    return entry;
  }

  private insert(entry: ColliderEntry): void {
    const b = entry.box;
    const x0 = this.cellCoord(b.min.x);
    const x1 = this.cellCoord(b.max.x);
    const z0 = this.cellCoord(b.min.z);
    const z1 = this.cellCoord(b.max.z);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let list = this.cells.get(k);
        if (!list) {
          list = [];
          this.cells.set(k, list);
        }
        list.push(entry);
        entry.cellKeys.push(k);
      }
    }
  }

  private unlink(entry: ColliderEntry): void {
    for (const k of entry.cellKeys) {
      const list = this.cells.get(k);
      if (!list) continue;
      const idx = list.indexOf(entry);
      if (idx >= 0) list.splice(idx, 1);
    }
    entry.cellKeys = [];
  }

  public remove(entry: ColliderEntry): void {
    this.unlink(entry);
    const idx = this.entries.indexOf(entry);
    if (idx >= 0) this.entries.splice(idx, 1);
  }

  /** Move/resize a collider (e.g. a sliding door) and re-index it. */
  public update(entry: ColliderEntry, newBox: THREE.Box3): void {
    this.unlink(entry);
    entry.box.copy(newBox);
    this.insert(entry);
  }

  public setEnabled(entry: ColliderEntry, enabled: boolean): void {
    entry.enabled = enabled;
  }

  public setBoxEnabled(targetBox: THREE.Box3, enabled: boolean): void {
    for (const e of this.entries) {
      if (e.userData === targetBox || e.box.equals(targetBox)) {
        e.enabled = enabled;
      }
    }
  }

  /** Returns enabled colliders whose cells overlap the given X/Z rectangle (broad phase only). */
  public queryArea(minX: number, minZ: number, maxX: number, maxZ: number, out: ColliderEntry[] = []): ColliderEntry[] {
    out.length = 0;
    const stamp = ++this.stampCounter;
    const x0 = this.cellCoord(minX);
    const x1 = this.cellCoord(maxX);
    const z0 = this.cellCoord(minZ);
    const z1 = this.cellCoord(maxZ);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const e of list) {
          if (e.stamp === stamp || !e.enabled) continue;
          e.stamp = stamp;
          out.push(e);
        }
      }
    }
    return out;
  }

  /** Enabled colliders that actually intersect the given box. */
  public queryBox(box: THREE.Box3, out: ColliderEntry[] = []): ColliderEntry[] {
    this.queryArea(box.min.x, box.min.z, box.max.x, box.max.z, out);
    let w = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i].box.intersectsBox(box)) out[w++] = out[i];
    }
    out.length = w;
    return out;
  }

  public containsPoint(p: THREE.Vector3): boolean {
    const list = this.cells.get(this.key(this.cellCoord(p.x), this.cellCoord(p.z)));
    if (!list) return false;
    for (const e of list) {
      if (e.enabled && e.box.containsPoint(p)) return true;
    }
    return false;
  }

  /**
   * Grid-traversal (DDA) raycast. `dir` must be normalized.
   * Returns the closest collider hit within `maxDist`, or null.
   */
  public raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, opts: RaycastOptions = {}): RaycastHit | null {
    const cs = this.cellSize;
    this.ray.origin.copy(origin);
    this.ray.direction.copy(dir);
    const stamp = ++this.stampCounter;

    let cx = this.cellCoord(origin.x);
    let cz = this.cellCoord(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const absX = Math.abs(dir.x);
    const absZ = Math.abs(dir.z);
    const tDeltaX = absX > 1e-9 ? cs / absX : Infinity;
    const tDeltaZ = absZ > 1e-9 ? cs / absZ : Infinity;
    let tMaxX = absX > 1e-9 ? (dir.x > 0 ? (cx + 1) * cs - origin.x : origin.x - cx * cs) / absX : Infinity;
    let tMaxZ = absZ > 1e-9 ? (dir.z > 0 ? (cz + 1) * cs - origin.z : origin.z - cz * cs) / absZ : Infinity;

    let best: ColliderEntry | null = null;
    let bestDist = maxDist;
    const bestPoint = new THREE.Vector3();
    let tEnter = 0;
    let guard = 0;

    while (tEnter <= bestDist && guard++ < 4096) {
      const list = this.cells.get(this.key(cx, cz));
      if (list) {
        for (const e of list) {
          if (e.stamp === stamp || !e.enabled) continue;
          e.stamp = stamp;
          if (opts.ignore && opts.ignore(e)) continue;
          if (this.ray.intersectBox(e.box, this.tmpHit)) {
            const d = this.tmpHit.distanceTo(origin);
            if (d < bestDist) {
              bestDist = d;
              best = e;
              bestPoint.copy(this.tmpHit);
            }
          }
        }
      }
      if (tMaxX === Infinity && tMaxZ === Infinity) break; // vertical ray: single cell
      if (tMaxX < tMaxZ) {
        tEnter = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        tEnter = tMaxZ;
        tMaxZ += tDeltaZ;
        cz += stepZ;
      }
    }

    if (!best) return null;
    return {
      point: bestPoint,
      normal: PhysicsWorld.boxNormalAt(best.box, bestPoint, dir),
      distance: bestDist,
      collider: best,
    };
  }

  /** True when nothing blocks the straight segment between `from` and `to` (with an end margin). */
  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3, endMargin = 0.4): boolean {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 1e-6) return true;
    dir.divideScalar(dist);
    return this.raycast(from, dir, Math.max(0, dist - endMargin)) === null;
  }

  /** Approximate outward face normal of a box at a surface point. */
  public static boxNormalAt(box: THREE.Box3, p: THREE.Vector3, rayDir?: THREE.Vector3): THREE.Vector3 {
    const candidates: [number, THREE.Vector3][] = [
      [Math.abs(p.x - box.min.x), new THREE.Vector3(-1, 0, 0)],
      [Math.abs(p.x - box.max.x), new THREE.Vector3(1, 0, 0)],
      [Math.abs(p.y - box.min.y), new THREE.Vector3(0, -1, 0)],
      [Math.abs(p.y - box.max.y), new THREE.Vector3(0, 1, 0)],
      [Math.abs(p.z - box.min.z), new THREE.Vector3(0, 0, -1)],
      [Math.abs(p.z - box.max.z), new THREE.Vector3(0, 0, 1)],
    ];
    candidates.sort((a, b) => a[0] - b[0]);
    const n = candidates[0][1];
    if (rayDir && n.dot(rayDir) > 0) n.negate();
    return n;
  }
}
