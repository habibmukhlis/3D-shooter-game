import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

const GRID_MIN = -70;
const GRID_MAX = 70;
const CELL_SIZE = 2.0;
const GRID_SIZE = Math.round((GRID_MAX - GRID_MIN) / CELL_SIZE); // 70x70
const AGENT_RADIUS = 0.5;
const MAX_ASTAR_ITERATIONS = 1200;

const DIRS_8: readonly [number, number, number][] = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export class NavGrid {
  public readonly gridSize = GRID_SIZE;
  public readonly cellSize = CELL_SIZE;
  private readonly blocked = new Uint8Array(GRID_SIZE * GRID_SIZE);

  // Reusable A* buffers to avoid per-call allocations
  private readonly gScore = new Float32Array(GRID_SIZE * GRID_SIZE);
  private readonly fScore = new Float32Array(GRID_SIZE * GRID_SIZE);
  private readonly parentIdx = new Int32Array(GRID_SIZE * GRID_SIZE);
  private readonly state = new Uint8Array(GRID_SIZE * GRID_SIZE); // 0 = unvisited, 1 = open, 2 = closed

  constructor(physics: PhysicsWorld) {
    this.rebuild(physics);
  }

  /**
   * Populates blocked cells from PhysicsWorld colliders whose vertical span
   * overlaps [0.3, 1.8], ignoring floor slabs (max.y <= 0.3) and high roofs (min.y >= 2.2).
   */
  public rebuild(physics: PhysicsWorld): void {
    this.blocked.fill(0);

    for (const entry of physics.all()) {
      if (!entry.enabled) continue;
      const box = entry.box;

      // Ignore thin floor slabs and high roofs/overhangs
      if (box.max.y <= 0.3 || box.min.y >= 2.2) continue;
      // Must overlap vertical human torso span [0.3, 1.8]
      if (box.max.y < 0.3 || box.min.y > 1.8) continue;

      const minX = box.min.x - AGENT_RADIUS;
      const maxX = box.max.x + AGENT_RADIUS;
      const minZ = box.min.z - AGENT_RADIUS;
      const maxZ = box.max.z + AGENT_RADIUS;

      const gx0 = this.worldToCellX(minX);
      const gx1 = this.worldToCellX(maxX);
      const gz0 = this.worldToCellZ(minZ);
      const gz1 = this.worldToCellZ(maxZ);

      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          if (this.inBounds(gx, gz)) {
            this.blocked[gz * GRID_SIZE + gx] = 1;
          }
        }
      }
    }
  }

  public inBounds(gx: number, gz: number): boolean {
    return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
  }

  public isCellBlocked(gx: number, gz: number): boolean {
    if (!this.inBounds(gx, gz)) return true;
    return this.blocked[gz * GRID_SIZE + gx] !== 0;
  }

  public isWorldPosBlocked(x: number, z: number): boolean {
    return this.isCellBlocked(this.worldToCellX(x), this.worldToCellZ(z));
  }

  public worldToCellX(x: number): number {
    return Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((x - GRID_MIN) / CELL_SIZE)));
  }

  public worldToCellZ(z: number): number {
    return Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((z - GRID_MIN) / CELL_SIZE)));
  }

  public cellToWorldX(gx: number): number {
    return GRID_MIN + (gx + 0.5) * CELL_SIZE;
  }

  public cellToWorldZ(gz: number): number {
    return GRID_MIN + (gz + 0.5) * CELL_SIZE;
  }

  /**
   * If a cell is blocked, snaps to the nearest unblocked cell within a 3-cell radius.
   */
  private snapToUnblocked(gx: number, gz: number, refX: number, refZ: number): [number, number] | null {
    if (!this.isCellBlocked(gx, gz)) {
      return [gx, gz];
    }

    let bestGx = -1;
    let bestGz = -1;
    let bestDistSq = Infinity;

    for (let r = 1; r <= 3; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = gx + dx;
          const nz = gz + dz;
          if (!this.isCellBlocked(nx, nz)) {
            const wx = this.cellToWorldX(nx);
            const wz = this.cellToWorldZ(nz);
            const dSq = (wx - refX) * (wx - refX) + (wz - refZ) * (wz - refZ);
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestGx = nx;
              bestGz = nz;
            }
          }
        }
      }
      if (bestGx !== -1) {
        return [bestGx, bestGz];
      }
    }

    return null;
  }

  private octileHeuristic(gx: number, gz: number, goalGx: number, goalGz: number): number {
    const dx = Math.abs(gx - goalGx);
    const dz = Math.abs(gz - goalGz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }

  /**
   * Computes an obstacle-avoiding path from `from` to `to` using 8-connected A*
   * and line-of-sight string-pulling at y = 1.0.
   */
  public findPath(from: THREE.Vector3, to: THREE.Vector3, physics: PhysicsWorld): THREE.Vector3[] {
    const baseY = from.y;
    const rawStartGx = this.worldToCellX(from.x);
    const rawStartGz = this.worldToCellZ(from.z);
    const rawGoalGx = this.worldToCellX(to.x);
    const rawGoalGz = this.worldToCellZ(to.z);

    const startSnap = this.snapToUnblocked(rawStartGx, rawStartGz, from.x, from.z);
    const goalSnap = this.snapToUnblocked(rawGoalGx, rawGoalGz, to.x, to.z);

    if (!startSnap || !goalSnap) {
      return [new THREE.Vector3(to.x, baseY, to.z)];
    }

    const [startGx, startGz] = startSnap;
    const [goalGx, goalGz] = goalSnap;

    if (startGx === goalGx && startGz === goalGz) {
      return [new THREE.Vector3(to.x, baseY, to.z)];
    }

    this.gScore.fill(Infinity);
    this.fScore.fill(Infinity);
    this.parentIdx.fill(-1);
    this.state.fill(0);

    const startIdx = startGz * GRID_SIZE + startGx;
    const goalIdx = goalGz * GRID_SIZE + goalGx;

    this.gScore[startIdx] = 0;
    const startH = this.octileHeuristic(startGx, startGz, goalGx, goalGz);
    this.fScore[startIdx] = startH;
    this.state[startIdx] = 1;

    // Simple binary min-heap on cell indices ordered by fScore
    const openHeap: number[] = [startIdx];
    const heapPush = (idx: number) => {
      openHeap.push(idx);
      let i = openHeap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.fScore[openHeap[i]] < this.fScore[openHeap[p]]) {
          const tmp = openHeap[i];
          openHeap[i] = openHeap[p];
          openHeap[p] = tmp;
          i = p;
        } else {
          break;
        }
      }
    };

    const heapPop = (): number => {
      const top = openHeap[0];
      const last = openHeap.pop()!;
      if (openHeap.length > 0) {
        openHeap[0] = last;
        let i = 0;
        const n = openHeap.length;
        while (true) {
          let smallest = i;
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          if (l < n && this.fScore[openHeap[l]] < this.fScore[openHeap[smallest]]) smallest = l;
          if (r < n && this.fScore[openHeap[r]] < this.fScore[openHeap[smallest]]) smallest = r;
          if (smallest !== i) {
            const tmp = openHeap[i];
            openHeap[i] = openHeap[smallest];
            openHeap[smallest] = tmp;
            i = smallest;
          } else {
            break;
          }
        }
      }
      return top;
    };

    let bestReachedIdx = startIdx;
    let bestReachedH = startH;
    let iterations = 0;

    while (openHeap.length > 0 && iterations < MAX_ASTAR_ITERATIONS) {
      const currentIdx = heapPop();
      if (this.state[currentIdx] === 2) continue;
      this.state[currentIdx] = 2;
      iterations++;

      if (currentIdx === goalIdx) {
        bestReachedIdx = goalIdx;
        break;
      }

      const cx = currentIdx % GRID_SIZE;
      const cz = (currentIdx / GRID_SIZE) | 0;
      const curG = this.gScore[currentIdx];

      for (let d = 0; d < DIRS_8.length; d++) {
        const [dx, dz, cost] = DIRS_8[d];
        const nx = cx + dx;
        const nz = cz + dz;
        if (this.isCellBlocked(nx, nz)) continue;

        // Diagonal movement requires both cardinal neighbors to be free
        if (dx !== 0 && dz !== 0) {
          if (this.isCellBlocked(cx + dx, cz) || this.isCellBlocked(cx, cz + dz)) {
            continue;
          }
        }

        const nIdx = nz * GRID_SIZE + nx;
        if (this.state[nIdx] === 2) continue;

        const tentativeG = curG + cost;
        if (tentativeG < this.gScore[nIdx]) {
          this.parentIdx[nIdx] = currentIdx;
          this.gScore[nIdx] = tentativeG;
          const h = this.octileHeuristic(nx, nz, goalGx, goalGz);
          this.fScore[nIdx] = tentativeG + h;
          this.state[nIdx] = 1;
          heapPush(nIdx);

          if (h < bestReachedH) {
            bestReachedH = h;
            bestReachedIdx = nIdx;
          }
        }
      }
    }

    // Reconstruct grid path
    const gridChain: number[] = [];
    let trace = bestReachedIdx;
    while (trace !== -1 && trace !== startIdx) {
      gridChain.push(trace);
      trace = this.parentIdx[trace];
    }
    gridChain.reverse();

    if (gridChain.length === 0) {
      return [new THREE.Vector3(to.x, baseY, to.z)];
    }

    const rawPoints: THREE.Vector3[] = [new THREE.Vector3(from.x, baseY, from.z)];
    for (const idx of gridChain) {
      const gx = idx % GRID_SIZE;
      const gz = (idx / GRID_SIZE) | 0;
      rawPoints.push(new THREE.Vector3(this.cellToWorldX(gx), baseY, this.cellToWorldZ(gz)));
    }

    // Replace or append exact destination if goal cell was reached and wasn't snapped away from a blocked cell
    if (bestReachedIdx === goalIdx && rawGoalGx === goalGx && rawGoalGz === goalGz) {
      rawPoints[rawPoints.length - 1].set(to.x, baseY, to.z);
    }

    return this.smoothPath(rawPoints, physics, baseY);
  }

  /**
   * String-pulls the path using physics.hasLineOfSight at y = 1.0 so enemies
   * walk natural diagonal lines around obstacles instead of jagged grid steps.
   */
  private smoothPath(rawPoints: THREE.Vector3[], physics: PhysicsWorld, baseY: number): THREE.Vector3[] {
    if (rawPoints.length <= 2) {
      return [rawPoints[rawPoints.length - 1].clone()];
    }

    const smoothed: THREE.Vector3[] = [];
    const losFrom = new THREE.Vector3();
    const losTo = new THREE.Vector3();
    const rightVec = new THREE.Vector3();
    const losFromSide = new THREE.Vector3();
    const losToSide = new THREE.Vector3();

    let anchorIdx = 0;
    while (anchorIdx < rawPoints.length - 1) {
      let furthestIdx = anchorIdx + 1;

      for (let testIdx = rawPoints.length - 1; testIdx > anchorIdx + 1; testIdx--) {
        losFrom.set(rawPoints[anchorIdx].x, 1.0, rawPoints[anchorIdx].z);
        losTo.set(rawPoints[testIdx].x, 1.0, rawPoints[testIdx].z);

        if (!physics.hasLineOfSight(losFrom, losTo, 0.25)) {
          continue;
        }

        // Also check slight lateral clearance (+/- 0.38m) so smoothed segments don't clip wall corners
        const dx = losTo.x - losFrom.x;
        const dz = losTo.z - losFrom.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.01) {
          rightVec.set(-dz / len, 0, dx / len).multiplyScalar(0.38);
          losFromSide.copy(losFrom).add(rightVec);
          losToSide.copy(losTo).add(rightVec);
          if (!physics.hasLineOfSight(losFromSide, losToSide, 0.25)) continue;

          losFromSide.copy(losFrom).sub(rightVec);
          losToSide.copy(losTo).sub(rightVec);
          if (!physics.hasLineOfSight(losFromSide, losToSide, 0.25)) continue;
        }

        furthestIdx = testIdx;
        break;
      }

      const pt = rawPoints[furthestIdx];
      smoothed.push(new THREE.Vector3(pt.x, baseY, pt.z));
      anchorIdx = furthestIdx;
    }

    return smoothed;
  }
}
