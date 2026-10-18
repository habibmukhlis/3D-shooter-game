import { soundManager } from '../../audio/SoundManager';
import type { GameContext, GameSystem } from '../core/GameContext';
import type { InteractiveItem } from '../MapBuilder';

export class InteractionSystem implements GameSystem {
  private ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    ctx.systems.input.onAction((action) => {
      if (action === 'interact') {
        this.triggerInteraction();
      } else if (action === 'interactRelease') {
        if (!this.ctx.extraction.isExtracting) {
          this.ctx.extraction.holdTimer = 0;
        }
      }
    });
  }

  public update(dt: number) {
    this.updateDoors(dt);
    this.updateInteractionPrompt();
    this.updateExtractionHold(dt);
  }

  private updateDoors(dt: number) {
    for (const item of this.ctx.mapData.interactiveItems) {
      if (item.type === 'door' && item.hingeGroup) {
        const baseRot = item.baseRotY ?? 0;
        const targetRot = item.isOpen ? baseRot + Math.PI * 0.48 : baseRot;
        const diff = targetRot - item.hingeGroup.rotation.y;
        if (Math.abs(diff) > 0.002) {
          item.hingeGroup.rotation.y += diff * Math.min(1, dt * 8);
        } else {
          item.hingeGroup.rotation.y = targetRot;
        }
      }
    }
  }

  private updateInteractionPrompt() {
    let nearestPrompt: string | null = null;
    let minDist = 3.2;
    const playerPos = this.ctx.player.pos;

    for (const item of this.ctx.mapData.interactiveItems) {
      if (item.isCollected && item.type !== 'door') continue;
      const d = playerPos.distanceTo(item.position);
      if (d < minDist) {
        minDist = d;
        if (item.type === 'ammo') nearestPrompt = 'PRESS [F] / [E] TO COLLECT AMMUNITION';
        else if (item.type === 'medkit') nearestPrompt = 'PRESS [F] / [E] TO USE COMBAT MEDKIT';
        else if (item.type === 'briefcase') nearestPrompt = 'PRESS [F] / [E] TO SECURE CLASSIFIED BRIEFCASE';
        else if (item.type === 'alarm_console') nearestPrompt = 'PRESS [F] / [E] TO HACK SECURITY SIREN TERMINAL';
        else if (item.type === 'generator') nearestPrompt = 'PRESS [F] / [E] TO SABOTAGE POWER TURBINE GRID';
        else if (item.type === 'radar_hack') nearestPrompt = 'PRESS [F] / [E] TO UPLOAD TELEMETRY OVERRIDE';
        else if (item.type === 'silo_override') nearestPrompt = 'PRESS [F] / [E] TO ABORT STRATEGIC MISSILE LAUNCH';
        else if (item.type === 'bunker_power') nearestPrompt = 'PRESS [F] / [E] TO DISABLE BACKUP DIESEL DYNAMO';
        else if (item.type === 'door') {
          nearestPrompt = item.isOpen
            ? 'PRESS [F] / [E] TO CLOSE TACTICAL DOOR'
            : 'PRESS [F] / [E] TO OPEN TACTICAL DOOR';
        } else if (item.type === 'locker') {
          nearestPrompt = 'PRESS [F] / [E] TO LOOT ARMORY SUPPLY LOCKER';
        } else if (item.type === 'breaker_box') {
          nearestPrompt = 'PRESS [F] / [E] TO CUT COMPOUND FLOODLIGHT POWER GRID';
        } else if (item.type === 'c4_target') {
          nearestPrompt = this.ctx.player.c4Planted
            ? 'PRESS [X] TO DETONATE C4 CHARGE ON FUEL MANIFOLD'
            : 'PRESS [F] / [E] OR [X] TO PLANT C4 DEMOLITION CHARGE';
        } else if (item.type === 'extraction') {
          const primaryDone = this.ctx.objectives
            .filter((o) => !o.isOptional && o.id !== 'obj_extract')
            .every((o) => o.isCompleted);
          if (this.ctx.extraction.isExtracting) {
            nearestPrompt = 'EXFILTRATION IN PROGRESS // RETURNING TO HQ...';
          } else if (primaryDone) {
            if (this.ctx.extraction.holdTimer > 0) {
              const remaining = Math.max(0, 1.5 - this.ctx.extraction.holdTimer).toFixed(1);
              nearestPrompt = `CONFIRMING EXFILTRATION... [HOLD F / E] (${remaining}s)`;
            } else {
              nearestPrompt = 'HOLD [F] OR [E] (1.5s) TO BOARD UH-60A BLACKHAWK';
            }
          } else {
            nearestPrompt = 'EXTRACTION LOCKED // PRIMARY DIRECTIVES INCOMPLETE';
          }
        }
      }
    }

    if (!nearestPrompt) {
      for (const ladder of this.ctx.mapData.ladders) {
        if (ladder.box.distanceToPoint(playerPos) < 1.2) {
          nearestPrompt = 'WATCHTOWER LADDER // HOLD [W] OR [SPACE] TO CLIMB';
          break;
        }
      }
    }

    this.ctx.feedback.prompt = nearestPrompt;
  }

  private updateExtractionHold(dt: number) {
    if (this.ctx.extraction.isExtracting) return;

    const extractZone = this.ctx.mapData.interactiveItems.find((i) => i.type === 'extraction');
    if (!extractZone) return;

    const d = this.ctx.player.pos.distanceTo(extractZone.position);
    if (d >= 3.8) {
      this.ctx.extraction.holdTimer = 0;
      return;
    }

    const primaryDone = this.ctx.objectives
      .filter((o) => !o.isOptional && o.id !== 'obj_extract')
      .every((o) => o.isCompleted);

    const input = this.ctx.systems.input.getActions();
    if (primaryDone && input.interact) {
      this.ctx.extraction.holdTimer += dt;
      if (this.ctx.extraction.holdTimer >= 1.5) {
        this.ctx.extraction.isExtracting = true;
        soundManager.playHelicopterExtraction();
        soundManager.playObjectiveCompleted();
        const obj = this.ctx.objectives.find((o) => o.id === 'obj_extract');
        if (obj) obj.isCompleted = true;
        this.ctx.feedback.prompt = 'EXFILTRATION CONFIRMED // RETURNING TO BASE...';
        setTimeout(() => {
          this.ctx.systems.objectives.endMission(true);
        }, 1200);
      }
    } else {
      this.ctx.extraction.holdTimer = 0;
    }
  }

  public triggerInteraction() {
    let nearestItem: InteractiveItem | null = null;
    let minDist = 3.4;
    const playerPos = this.ctx.player.pos;

    for (const item of this.ctx.mapData.interactiveItems) {
      if (item.isCollected && item.type !== 'door') continue;
      const dist = playerPos.distanceTo(item.position);
      if (dist < minDist) {
        minDist = dist;
        nearestItem = item;
      }
    }

    if (!nearestItem) return;

    if (nearestItem.type === 'ammo') {
      nearestItem.isCollected = true;
      this.ctx.scene.remove(nearestItem.mesh);
      const weapons = this.ctx.systems.weapons.weapons;
      if (weapons[1]) weapons[1].reserve += 15;
      if (weapons[2]) weapons[2].reserve += 30;
      if (weapons[3]) weapons[3].reserve += 10;
      if (weapons[4]) weapons[4].reserve += 1;
      soundManager.playPickup();
    } else if (nearestItem.type === 'medkit') {
      nearestItem.isCollected = true;
      this.ctx.scene.remove(nearestItem.mesh);
      this.ctx.systems.player.heal(50, 25);
      soundManager.playPickup();
    } else if (nearestItem.type === 'door') {
      nearestItem.isOpen = !nearestItem.isOpen;
      if (nearestItem.colliderBox) {
        this.ctx.physics.setBoxEnabled(nearestItem.colliderBox, !nearestItem.isOpen);
      }
      soundManager.playFootstep(false, true);
      this.ctx.events.emit('noise', {
        origin: nearestItem.position.clone(),
        radius: 6,
        kind: 'door',
      });
    } else if (nearestItem.type === 'locker') {
      nearestItem.isCollected = true;
      if (nearestItem.hingeGroup) {
        nearestItem.hingeGroup.rotation.y = (nearestItem.baseRotY ?? 0) + Math.PI * 0.55;
      }
      const weapons = this.ctx.systems.weapons.weapons;
      if (weapons[1]) weapons[1].reserve += 15;
      if (weapons[2]) weapons[2].reserve += 30;
      if (weapons[3]) weapons[3].reserve += 5;
      if (weapons[4]) weapons[4].reserve += 1;
      this.ctx.player.grenades = Math.min(5, this.ctx.player.grenades + 1);
      this.ctx.systems.player.heal(25, 25);
      soundManager.playPickup();
    } else if (nearestItem.type === 'breaker_box') {
      nearestItem.isCollected = true;
      this.ctx.mapData.powerCut = true;
      this.ctx.systems.world.setPowerCut?.(true);
      soundManager.playGeneratorSabotage();
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_power_grid' });
    } else if (nearestItem.type === 'c4_target') {
      this.ctx.systems.weapons.plantOrDetonateC4();
    } else if (nearestItem.type === 'briefcase') {
      nearestItem.isCollected = true;
      this.ctx.scene.remove(nearestItem.mesh);
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_briefcase' });
    } else if (nearestItem.type === 'alarm_console') {
      this.ctx.alarm.active = false;
      soundManager.stopBaseSiren();
      soundManager.playHackSound();
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_alarm' });
    } else if (nearestItem.type === 'generator') {
      nearestItem.isCollected = true;
      this.ctx.alarm.active = false;
      this.ctx.mapData.powerCut = true;
      this.ctx.systems.world.setPowerCut?.(true);
      soundManager.playGeneratorSabotage();
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_generator' });
    } else if (nearestItem.type === 'radar_hack') {
      nearestItem.isCollected = true;
      soundManager.playHackSound();
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_radar_hack' });
    } else if (nearestItem.type === 'silo_override') {
      nearestItem.isCollected = true;
      soundManager.playHackSound();
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_silo_override' });
    } else if (nearestItem.type === 'bunker_power') {
      nearestItem.isCollected = true;
      soundManager.playGeneratorSabotage();
      this.ctx.events.emit('objectiveCompleted', { id: 'obj_bunker_breach' });
    } else if (nearestItem.type === 'extraction') {
      const primaryDone = this.ctx.objectives
        .filter((o) => !o.isOptional && o.id !== 'obj_extract')
        .every((o) => o.isCompleted);
      if (!primaryDone) {
        soundManager.playDryFire();
        this.ctx.feedback.prompt = 'HQ ADVISORY: CANNOT EXTRACT // PRIMARY OBJECTIVES STILL PENDING!';
      }
    }
  }
}
