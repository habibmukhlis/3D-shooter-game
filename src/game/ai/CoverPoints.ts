import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

const STANDOFF = 1.15;
const AGENT_CLEARANCE = 0.45;

export class CoverPoints {
  private readonly points: THREE.Vector3[] = [];
  private readonly testBox = new THREE.Box3();
  private readonly coverEye = new THREE.Vector3();
  private readonly threatEye = new THREE.Vector3();

  constructor(physics: PhysicsWorld) {
    this.rebuild(physics);
  }

  /**
   * Generates tactical cover positions around low/medium obstacles
   * (box.max.y >= 0.9 and width/depth <= 18) from PhysicsWorld.
   */
  public rebuild(physics: PhysicsWorld): void {
    this.points.length = 0;

    for (const entry of physics.all()) {
      if (!entry.enabled) continue;
      const box = entry.box;

      // Must be a ground-level low/medium obstacle capable of blocking torso/head shots
      if (box.max.y < 0.9 || box.min.y > 1.5) continue;

      const width = box.max.x - box.min.x;
      const depth = box.max.z - box.min.z;

      if (width > 18 || depth > 18) continue;
      if (width < 0.35 || depth < 0.35) continue;

      const midX = (box.min.x + box.max.x) * 0.5;
      const midZ = (box.min.z + box.max.z) * 0.5;

      // Skip outer map boundary walls
      if (Math.abs(midX) > 58 || Math.abs(midZ) > 58) continue;

      const candidates: [number, number][] = [
        [box.min.x - STANDOFF, midZ],
        [box.max.x + STANDOFF, midZ],
        [midX, box.min.z - STANDOFF],
        [midX, box.max.z + STANDOFF],
      ];

      // Add extra cover slots along wider obstacles (containers, walls, bunkers)
      if (width > 4.5) {
        const q1X = box.min.x + width * 0.25;
        const q3X = box.min.x + width * 0.75;
        candidates.push(
          [q1X, box.min.z - STANDOFF],
          [q3X, box.min.z - STANDOFF],
          [q1X, box.max.z + STANDOFF],
          [q3X, box.max.z + STANDOFF]
        );
      }

      if (depth > 4.5) {
        const q1Z = box.min.z + depth * 0.25;
        const q3Z = box.min.z + depth * 0.75;
        candidates.push(
          [box.min.x - STANDOFF, q1Z],
          [box.min.x - STANDOFF, q3Z],
          [box.max.x + STANDOFF, q1Z],
          [box.max.x + STANDOFF, q3Z]
        );
      }

      for (const [cx, cz] of candidates) {
        if (this.isPointWalkable(cx, cz, physics)) {
          this.points.push(new THREE.Vector3(cx, 0, cz));
        }
      }
    }
  }

  private isPointWalkable(x: number, z: number, physics: PhysicsWorld): boolean {
    if (Math.abs(x) > 64 || Math.abs(z) > 64) return false;
    this.testBox.min.set(x - AGENT_CLEARANCE, 0.35, z - AGENT_CLEARANCE);
    this.testBox.max.set(x + AGENT_CLEARANCE, 1.75, z + AGENT_CLEARANCE);
    return physics.queryBox(this.testBox).length === 0;
  }

  public getAllPoints(): readonly THREE.Vector3[] {
    return this.points;
  }

  /**
   * Picks the best walkable cover point within `maxDist` of `enemyPos` where an
   * obstacle blocks line-of-sight between the cover point (y = 1.2) and `threatPos` (y = 1.5).
   */
  public findBestCover(
    enemyPos: THREE.Vector3,
    threatPos: THREE.Vector3,
    physics: PhysicsWorld,
    maxDist = 22
  ): THREE.Vector3 | null {
    const maxDistSq = maxDist * maxDist;
    this.threatEye.set(threatPos.x, 1.5, threatPos.z);

    let bestPoint: THREE.Vector3 | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const dxE = pt.x - enemyPos.x;
      const dzE = pt.z - enemyPos.z;
      const distEnemySq = dxE * dxE + dzE * dzE;
      if (distEnemySq > maxDistSq) continue;

      const dxT = pt.x - threatPos.x;
      const dzT = pt.z - threatPos.z;
      const distThreatSq = dxT * dxT + dzT * dzT;
      // Avoid cover right on top of the threat
      if (distThreatSq < 20) continue;

      this.coverEye.set(pt.x, 1.2, pt.z);
      if (physics.containsPoint(this.coverEye)) continue;

      // Cover is valid when LOS between cover (y=1.2) and threat (y=1.5) is blocked
      if (physics.hasLineOfSight(this.coverEye, this.threatEye, 0.25)) {
        continue;
      }

      const distEnemy = Math.sqrt(distEnemySq);
      const distThreat = Math.sqrt(distThreatSq);
      // Prefer nearby cover that maintains a tactical engagement distance (~14m from threat)
      const threatDistPenalty = Math.abs(distThreat - 14) * 0.35;
      const score = distEnemy + threatDistPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestPoint = pt;
      }
    }

    return bestPoint ? new THREE.Vector3(bestPoint.x, enemyPos.y, bestPoint.z) : null;
  }
}
