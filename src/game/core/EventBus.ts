import type * as THREE from 'three';
import type { WeaponId } from '../../types/game';
import type { EnemyEntry } from './GameContext';

export type NoiseKind = 'gunshot' | 'footstep' | 'explosion' | 'impact' | 'door' | 'glass' | 'voice';

/** Strongly typed game-wide events. Systems broadcast here instead of calling each other directly. */
export interface GameEvents {
  noise: { origin: THREE.Vector3; radius: number; kind: NoiseKind };
  alarm: { source: string };
  enemyKilled: { enemy: EnemyEntry; headshot: boolean };
  enemyDamaged: { enemy: EnemyEntry; amount: number; headshot: boolean };
  playerDamaged: { amount: number; source: THREE.Vector3 };
  objectiveCompleted: { id: string };
  explosion: { position: THREE.Vector3; radius: number; damage: number };
  shotFired: { weaponId: WeaponId; origin: THREE.Vector3; direction: THREE.Vector3 };
  missionEnd: { victory: boolean };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers: { [K in keyof GameEvents]?: Handler<GameEvents[K]>[] } = {};

  public on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    const list = (this.handlers[type] ??= []) as Handler<GameEvents[K]>[];
    list.push(fn);
    return () => {
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  public emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const list = this.handlers[type] as Handler<GameEvents[K]>[] | undefined;
    if (!list) return;
    // Copy so handlers may unsubscribe during dispatch
    for (const fn of [...list]) fn(payload);
  }

  public clear(): void {
    this.handlers = {};
  }
}
