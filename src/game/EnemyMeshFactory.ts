import * as THREE from 'three';
import { EnemyAlertState, EnemyRole } from '../types/game';

export class EnemyMeshFactory {
  public static createSoldierMesh(role: EnemyRole): {
    group: THREE.Group;
    visorMat: THREE.MeshBasicMaterial;
    bodyGroup: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    weaponGroup: THREE.Group;
  } {
    const group = new THREE.Group();
    const bodyGroup = new THREE.Group();
    group.add(bodyGroup);

    // Camo uniform material
    const uniformMat = new THREE.MeshStandardMaterial({
      color: role === 'sniper' ? 0x242a22 : 0x364032, // Dark forest / olive camo
      roughness: 0.8,
    });
    // Tactical plate carrier vest
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x1f231e,
      roughness: 0.7,
      metalness: 0.1,
    });
    // Helmet
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x252b22,
      roughness: 0.6,
      metalness: 0.3,
    });
    // Visor LED (changes color with alert state)
    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e, // Green default
    });
    // Gun metal
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x181a1c,
      roughness: 0.3,
      metalness: 0.8,
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.28);
    const torso = new THREE.Mesh(torsoGeo, uniformMat);
    torso.position.y = 1.15;
    bodyGroup.add(torso);

    // Plate carrier vest
    const vestGeo = new THREE.BoxGeometry(0.54, 0.5, 0.32);
    const vest = new THREE.Mesh(vestGeo, vestMat);
    vest.position.y = 1.18;
    bodyGroup.add(vest);

    // 2. Head
    const headGeo = new THREE.SphereGeometry(0.16, 12, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.62;
    bodyGroup.add(head);

    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 1.66;
    bodyGroup.add(helmet);

    // Night vision / Tactical Visor
    const visorGeo = new THREE.BoxGeometry(0.22, 0.06, 0.08);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.63, 0.15);
    bodyGroup.add(visor);

    // 3. Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.8, 0.18);
    const leftLeg = new THREE.Mesh(legGeo, uniformMat);
    leftLeg.position.set(-0.16, 0.4, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, uniformMat);
    rightLeg.position.set(0.16, 0.4, 0);
    group.add(rightLeg);

    // Boots
    const bootGeo = new THREE.BoxGeometry(0.2, 0.15, 0.26);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111211, roughness: 0.9 });
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.16, 0.08, 0.03);
    group.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.16, 0.08, 0.03);
    group.add(rightBoot);

    // 4. Arms & Weapon
    const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);
    const leftArm = new THREE.Mesh(armGeo, uniformMat);
    leftArm.position.set(-0.34, 1.15, 0.1);
    leftArm.rotation.x = 0.5;
    bodyGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, uniformMat);
    rightArm.position.set(0.34, 1.15, 0.15);
    rightArm.rotation.x = 0.7;
    bodyGroup.add(rightArm);

    // Held Weapon
    const weaponGroup = new THREE.Group();
    const gunBodyGeo = new THREE.BoxGeometry(0.06, 0.09, 0.6);
    const gunBody = new THREE.Mesh(gunBodyGeo, gunMat);
    weaponGroup.add(gunBody);

    const gunBarrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8);
    const gunBarrel = new THREE.Mesh(gunBarrelGeo, gunMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.02, 0.45);
    weaponGroup.add(gunBarrel);

    weaponGroup.position.set(0.12, 1.05, 0.35);
    weaponGroup.rotation.x = 0.2;
    bodyGroup.add(weaponGroup);

    return { group, visorMat, bodyGroup, leftLeg, rightLeg, weaponGroup };
  }

  public static updateVisorColor(visorMat: THREE.MeshBasicMaterial, alertState: EnemyAlertState) {
    if (alertState === 'idle') {
      visorMat.color.setHex(0x22c55e); // Green
    } else if (alertState === 'suspicious' || alertState === 'investigating') {
      visorMat.color.setHex(0xeab308); // Yellow
    } else if (alertState === 'combat') {
      visorMat.color.setHex(0xef4444); // Red
    } else {
      visorMat.color.setHex(0x475569); // Off / dead
    }
  }
}
