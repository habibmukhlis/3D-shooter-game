import { soundManager } from '../../audio/SoundManager';
import type { GameContext, GameSystem } from '../core/GameContext';

export class ObjectiveSystem implements GameSystem {
  private ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    ctx.events.on('objectiveCompleted', ({ id }) => {
      this.completeObjective(id);
    });

    ctx.events.on('explosion', ({ position }) => {
      for (const item of this.ctx.mapData.interactiveItems) {
        if (item.type === 'c4_target' && !item.isCollected) {
          if (item.position.distanceTo(position) < 9.5) {
            item.isCollected = true;
            this.ctx.scene.remove(item.mesh);
            this.completeObjective('obj_c4_manifold');
          }
        }
      }
    });

    ctx.events.on('enemyKilled', ({ enemy }) => {
      if (enemy.data.id === 'guard_officer') {
        this.completeObjective('obj_officer');
      }
      if (enemy.data.id === 'guard_commander') {
        this.completeObjective('obj_commander');
      }
      if (enemy.data.id === 'm4_admiral') {
        this.completeObjective('obj_harbor_admiral');
      }
      const snipersAlive = ctx.enemies.filter((e) => e.data.role === 'sniper' && !e.isDead).length;
      if (snipersAlive === 0) {
        this.completeObjective('obj_snipers');
      }
    });
  }

  public completeObjective(id: string) {
    const obj = this.ctx.objectives.find((o) => o.id === id);
    if (obj && !obj.isCompleted) {
      obj.isCompleted = true;
      soundManager.playObjectiveCompleted();
    }
  }

  public endMission(victory: boolean) {
    if (this.ctx.hasEnded) return;
    this.ctx.hasEnded = true;

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    soundManager.stopBaseSiren();

    const elapsed = Math.round((Date.now() - this.ctx.stats.startTime) / 1000);
    const accuracy =
      this.ctx.stats.shotsFired > 0
        ? Math.round((this.ctx.stats.shotsHit / this.ctx.stats.shotsFired) * 100)
        : 100;

    this.ctx.events.emit('missionEnd', { victory });
    this.ctx.callbacks.onMissionEnd(victory, {
      kills: this.ctx.stats.kills,
      headshots: this.ctx.stats.headshots,
      time: elapsed,
      shotsFired: this.ctx.stats.shotsFired,
      accuracy,
      alarms: this.ctx.stats.alarms,
    });
  }

  public update() {
    // Event-driven
  }
}
