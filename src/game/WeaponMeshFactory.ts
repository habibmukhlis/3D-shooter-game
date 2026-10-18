import * as THREE from 'three';
import { WeaponId } from '../types/game';
import { AssetLoader } from './AssetLoader';

export class WeaponMeshFactory {
  public static createWeaponMesh(weaponId: WeaponId): THREE.Group {
    const group = new THREE.Group();

    const metalDark = new THREE.MeshStandardMaterial({
      color: 0x222428,
      metalness: 0.85,
      roughness: 0.35,
    });
    const metalBlack = new THREE.MeshStandardMaterial({
      color: 0x111214,
      metalness: 0.9,
      roughness: 0.25,
    });
    const polymerWood = new THREE.MeshStandardMaterial({
      color: 0x4a2e18, // Kalashnikov wood/polymer
      roughness: 0.6,
      metalness: 0.1,
    });
    const magOrange = new THREE.MeshStandardMaterial({
      color: 0x8a3814, // Bakelite magazine
      roughness: 0.5,
      metalness: 0.15,
    });
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x1c211e,
      roughness: 0.85,
      metalness: 0.05,
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x2b352c,
      roughness: 0.8,
      metalness: 0.05,
    });

    if (weaponId === 'ak74m') {
      const glbRifle = AssetLoader.cloneNormalizedModel('assault_rifle', {
        castShadow: false,
        receiveShadow: false,
      });

      if (glbRifle) {
        // Measure natural bounding box of the GLB rifle and orient its longest axis along -Z
        const rawBox = new THREE.Box3().setFromObject(glbRifle);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        if (rawSize.x > rawSize.z) {
          glbRifle.rotation.y = -Math.PI / 2;
        }
        glbRifle.updateMatrixWorld(true);
        const alignedBox = new THREE.Box3().setFromObject(glbRifle);
        const alignedSize = new THREE.Vector3();
        const alignedCenter = new THREE.Vector3();
        alignedBox.getSize(alignedSize);
        alignedBox.getCenter(alignedCenter);

        const desiredLength = 0.78;
        const scale = desiredLength / Math.max(alignedSize.z, 0.001);
        glbRifle.scale.multiplyScalar(scale);
        glbRifle.position.set(
          -alignedCenter.x * scale,
          -alignedCenter.y * scale - 0.02,
          -alignedCenter.z * scale - 0.15
        );
        group.add(glbRifle);
      } else {
        // Procedural fallback AK-74M
        const receiverGeo = new THREE.BoxGeometry(0.08, 0.11, 0.42);
        const receiver = new THREE.Mesh(receiverGeo, metalDark);
        group.add(receiver);

        const coverGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8);
        const cover = new THREE.Mesh(coverGeo, metalBlack);
        cover.rotation.x = Math.PI / 2;
        cover.position.set(0, 0.06, -0.01);
        group.add(cover);

        const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8);
        const barrel = new THREE.Mesh(barrelGeo, metalDark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.04, -0.42);
        group.add(barrel);

        const muzzleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.09, 8);
        const muzzle = new THREE.Mesh(muzzleGeo, metalBlack);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 0.04, -0.67);
        group.add(muzzle);

        const handguardGeo = new THREE.BoxGeometry(0.075, 0.09, 0.26);
        const handguard = new THREE.Mesh(handguardGeo, polymerWood);
        handguard.position.set(0, 0.035, -0.28);
        group.add(handguard);

        const magGeo = new THREE.BoxGeometry(0.05, 0.26, 0.1);
        const mag = new THREE.Mesh(magGeo, magOrange);
        mag.position.set(0, -0.15, -0.06);
        mag.rotation.x = 0.25;
        group.add(mag);

        const gripGeo = new THREE.BoxGeometry(0.05, 0.18, 0.07);
        const grip = new THREE.Mesh(gripGeo, polymerWood);
        grip.position.set(0, -0.12, 0.16);
        grip.rotation.x = -0.4;
        group.add(grip);

        const frontSightGeo = new THREE.BoxGeometry(0.012, 0.04, 0.02);
        const frontSight = new THREE.Mesh(frontSightGeo, metalBlack);
        frontSight.position.set(0, 0.075, -0.58);
        group.add(frontSight);

        const rearSightGeo = new THREE.BoxGeometry(0.025, 0.02, 0.04);
        const rearSight = new THREE.Mesh(rearSightGeo, metalBlack);
        rearSight.position.set(0, 0.08, -0.15);
        group.add(rearSight);
      }

      // First-person tactical support hand & sleeve
      const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.1), gloveMat);
      leftHand.position.set(-0.02, -0.04, -0.26);
      group.add(leftHand);

      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.34), sleeveMat);
      leftArm.position.set(-0.12, -0.12, -0.08);
      leftArm.rotation.y = 0.45;
      leftArm.rotation.x = 0.25;
      group.add(leftArm);

      // Default hold offset
      group.position.set(0.18, -0.2, -0.42);
    } else if (weaponId === 'silenced_pistol') {
      // Pistol Slide
      const slideGeo = new THREE.BoxGeometry(0.05, 0.06, 0.22);
      const slide = new THREE.Mesh(slideGeo, metalDark);
      group.add(slide);

      // Grip
      const gripGeo = new THREE.BoxGeometry(0.046, 0.16, 0.07);
      const grip = new THREE.Mesh(gripGeo, metalBlack);
      grip.position.set(0, -0.09, 0.06);
      grip.rotation.x = -0.3;
      group.add(grip);

      // Suppressor / Silencer cylinder
      const silencerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.28, 12);
      const silencer = new THREE.Mesh(silencerGeo, metalBlack);
      silencer.rotation.x = Math.PI / 2;
      silencer.position.set(0, 0.005, -0.25);
      group.add(silencer);

      // Front and rear sights
      const sightGeo = new THREE.BoxGeometry(0.01, 0.02, 0.015);
      const fSight = new THREE.Mesh(sightGeo, metalBlack);
      fSight.position.set(0, 0.038, -0.09);
      const rSight = new THREE.Mesh(sightGeo, metalBlack);
      rSight.position.set(0, 0.038, 0.09);
      group.add(fSight);
      group.add(rSight);

      group.position.set(0.16, -0.16, -0.36);
    } else if (weaponId === 'sniper') {
      // Long rifle stock & body
      const bodyGeo = new THREE.BoxGeometry(0.06, 0.1, 0.6);
      const body = new THREE.Mesh(bodyGeo, metalBlack);
      group.add(body);

      // Long high-caliber sniper barrel
      const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.7, 8);
      const barrel = new THREE.Mesh(barrelGeo, metalDark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, -0.58);
      group.add(barrel);

      // Muzzle flash hider
      const muzzleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8);
      const muzzle = new THREE.Mesh(muzzleGeo, metalDark);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.03, -0.98);
      group.add(muzzle);

      // Telescopic PSO-1 Sniper Scope
      const scopeTubeGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.35, 12);
      const scopeTube = new THREE.Mesh(scopeTubeGeo, metalBlack);
      scopeTube.rotation.x = Math.PI / 2;
      scopeTube.position.set(0, 0.11, -0.08);
      group.add(scopeTube);

      // Scope lens caps
      const lensGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.04, 12);
      const lensFront = new THREE.Mesh(lensGeo, metalDark);
      lensFront.rotation.x = Math.PI / 2;
      lensFront.position.set(0, 0.11, -0.26);
      const lensBack = new THREE.Mesh(lensGeo, metalDark);
      lensBack.rotation.x = Math.PI / 2;
      lensBack.position.set(0, 0.11, 0.08);
      group.add(lensFront);
      group.add(lensBack);

      // Scope mount
      const mountGeo = new THREE.BoxGeometry(0.02, 0.06, 0.14);
      const mount = new THREE.Mesh(mountGeo, metalDark);
      mount.position.set(0, 0.07, -0.08);
      group.add(mount);

      // Skeleton stock
      const stockGeo = new THREE.BoxGeometry(0.04, 0.12, 0.28);
      const stock = new THREE.Mesh(stockGeo, polymerWood);
      stock.position.set(0, -0.04, 0.38);
      group.add(stock);

      group.position.set(0.18, -0.22, -0.45);
    } else if (weaponId === 'rpg7') {
      // RPG-7 Launcher Tube + Wooden Heat Shield + PG-7V Warhead
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2c3527, metalness: 0.7, roughness: 0.4 });
      const warheadMat = new THREE.MeshStandardMaterial({ color: 0x3b4d2b, metalness: 0.5, roughness: 0.45 });

      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.85, 12), tubeMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.04, -0.25);
      group.add(tube);

      const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.34, 12), polymerWood);
      heatShield.rotation.x = Math.PI / 2;
      heatShield.position.set(0, 0.04, -0.12);
      group.add(heatShield);

      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.24, 12), warheadMat);
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(0, 0.04, -0.78);
      group.add(cone);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), polymerWood);
      grip.position.set(0, -0.08, -0.18);
      grip.rotation.x = -0.25;
      group.add(grip);

      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.065, 0.025), metalBlack);
      sight.position.set(0, 0.095, -0.45);
      group.add(sight);

      group.position.set(0.22, -0.2, -0.38);
    } else {
      // Tactical Combat Knife
      const bladeGeo = new THREE.BoxGeometry(0.01, 0.05, 0.25);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.15,
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, 0, -0.15);
      group.add(blade);

      // Crossguard
      const guardGeo = new THREE.BoxGeometry(0.02, 0.08, 0.02);
      const guard = new THREE.Mesh(guardGeo, metalBlack);
      guard.position.set(0, 0, -0.02);
      group.add(guard);

      // Textured tactical handle
      const handleGeo = new THREE.BoxGeometry(0.035, 0.045, 0.16);
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x222622,
        roughness: 0.8,
      });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(0, 0, 0.08);
      group.add(handle);

      group.position.set(0.2, -0.2, -0.32);
      group.rotation.x = 0.4;
    }

    return group;
  }
}
