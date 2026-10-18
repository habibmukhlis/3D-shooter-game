import * as THREE from 'three';
import { AssetLoader } from '../AssetLoader';
import { TextureFactory } from '../TextureFactory';
import type { BreakableProp, ExplosiveBarrel, InteractiveItem } from '../MapBuilder';

export class PropKit {
  /**
   * Renders asphalt road strips with painted center dashes and edge lines on the compound ground.
   */
  public static addCompoundRoads(
    scene: THREE.Scene,
    roads: { x: number; z: number; width: number; length: number; axis: 'x' | 'z' }[]
  ) {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      roughness: 0.92,
      metalness: 0.05,
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });

    for (const r of roads) {
      const geo =
        r.axis === 'z'
          ? new THREE.PlaneGeometry(r.width, r.length)
          : new THREE.PlaneGeometry(r.length, r.width);
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(r.x, 0.02, r.z);
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Center dashed markings
      const count = Math.floor(r.length / 6);
      for (let i = 0; i < count; i++) {
        const offset = -r.length / 2 + (i + 0.5) * (r.length / count);
        const dashGeo =
          r.axis === 'z' ? new THREE.PlaneGeometry(0.22, 2.4) : new THREE.PlaneGeometry(2.4, 0.22);
        const dash = new THREE.Mesh(dashGeo, stripeMat);
        dash.rotation.x = -Math.PI / 2;
        if (r.axis === 'z') {
          dash.position.set(r.x, 0.028, r.z + offset);
        } else {
          dash.position.set(r.x + offset, 0.028, r.z);
        }
        scene.add(dash);
      }
    }
  }

  /**
   * Places steel industrial floodlight poles whose lights are tied to the compound power grid.
   */
  public static addFloodlightPoles(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    compoundLights: THREE.Light[],
    positions: [number, number, number][]
  ) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.8 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (const [px, py, pz] of positions) {
      const group = new THREE.Group();
      group.position.set(px, py, pz);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 8), poleMat);
      pole.position.y = 3.25;
      pole.castShadow = true;
      group.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.14), poleMat);
      arm.position.set(0.35, 6.4, 0);
      group.add(arm);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.32), bulbMat);
      hood.position.set(0.65, 6.32, 0);
      group.add(hood);

      const light = new THREE.PointLight(0xfef08a, 1.8, 22);
      light.position.set(0.65, 6.0, 0);
      group.add(light);
      compoundLights.push(light);

      scene.add(group);
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(px - 0.25, py, pz - 0.25),
          new THREE.Vector3(px + 0.25, py + 6.5, pz + 0.25)
        )
      );
    }
  }

  /**
   * Builds heavy-duty warehouse shelving racks stocked with destructible crates.
   */
  public static addWarehouseShelvingRacks(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    breakableProps: BreakableProp[],
    rackCenters: [number, number, number][],
    idPrefix: string
  ) {
    const rackMat = TextureFactory.getMetalTrimMaterial();
    const crateTex = TextureFactory.getCrateTexture();
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.75, metalness: 0.1 });

    rackCenters.forEach(([rx, ry, rz], idx) => {
      const rackW = 2.0;
      const rackL = 7.5;
      const rackH = 3.8;

      const group = new THREE.Group();
      group.position.set(rx, ry, rz);

      // 4 Vertical Uprights
      const postGeo = new THREE.BoxGeometry(0.14, rackH, 0.14);
      [
        [-rackW / 2 + 0.1, -rackL / 2 + 0.1],
        [rackW / 2 - 0.1, -rackL / 2 + 0.1],
        [-rackW / 2 + 0.1, rackL / 2 - 0.1],
        [rackW / 2 - 0.1, rackL / 2 - 0.1],
      ].forEach(([ox, oz]) => {
        const post = new THREE.Mesh(postGeo, rackMat);
        post.position.set(ox, rackH / 2, oz);
        post.castShadow = true;
        group.add(post);
      });

      // 2 Horizontal Shelf Decks
      for (const shelfY of [1.5, 3.1]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.12, rackL), rackMat);
        shelf.position.set(0, shelfY, 0);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        group.add(shelf);
      }

      scene.add(group);
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(rx - rackW / 2, ry, rz - rackL / 2),
          new THREE.Vector3(rx + rackW / 2, ry + rackH, rz + rackL / 2)
        )
      );

      // Destructible wooden supply crates on the ground beside the rack
      const cratePos = new THREE.Vector3(rx + 1.85, ry + 0.55, rz + (idx % 2 === 0 ? -1.8 : 1.8));
      const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), crateMat);
      crateMesh.position.copy(cratePos);
      crateMesh.castShadow = true;
      crateMesh.receiveShadow = true;
      scene.add(crateMesh);

      const crateBox = new THREE.Box3(
        new THREE.Vector3(cratePos.x - 0.55, ry, cratePos.z - 0.55),
        new THREE.Vector3(cratePos.x + 0.55, ry + 1.1, cratePos.z + 0.55)
      );
      colliders.push(crateBox);

      breakableProps.push({
        id: `${idPrefix}_crate_${idx}`,
        kind: 'crate',
        mesh: crateMesh,
        position: cratePos.clone(),
        box: crateBox,
        health: 35,
        isBroken: false,
        spawnsPickup: idx % 2 === 0 ? 'ammo' : 'medkit',
      });
    });
  }

  /**
   * Builds an industrial fuel storage tank depot with an optional C4 demolition target manifold.
   */
  public static addFuelDepotManifold(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    interactiveItems: InteractiveItem[],
    pos: THREE.Vector3,
    addC4Target = false
  ) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const tankMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.75 });
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.8 });
    const padMat = TextureFactory.getConcreteMaterial();

    // Concrete containment pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 7), padMat);
    pad.position.y = 0.125;
    pad.receiveShadow = true;
    group.add(pad);

    // Dual horizontal cylindrical fuel tanks
    for (const tz of [-1.7, 1.7]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 7.6, 16), tankMat);
      tank.rotation.z = Math.PI / 2;
      tank.position.set(0, 1.7, tz);
      tank.castShadow = true;
      group.add(tank);
    }

    // High-pressure red valve manifold on the +X end
    const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 2.4), pipeMat);
    manifold.position.set(4.1, 0.95, 0);
    manifold.castShadow = true;
    group.add(manifold);

    scene.add(group);
    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(pos.x - 4.8, pos.y, pos.z - 3.3),
        new THREE.Vector3(pos.x + 4.6, pos.y + 3.1, pos.z + 3.3)
      )
    );

    if (addC4Target) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      beacon.position.set(pos.x + 4.6, pos.y + 1.35, pos.z);
      scene.add(beacon);

      interactiveItems.push({
        id: 'obj_c4_manifold',
        type: 'c4_target',
        position: new THREE.Vector3(pos.x + 4.6, pos.y + 1.0, pos.z),
        mesh: beacon,
        isCollected: false,
        label: 'PLANT C4 CHARGE ON FUEL MANIFOLD',
      });
    }
  }

  /**
   * Places GLB architectural models with tight, non-inflated footprint colliders and
   * deduplicated materials so draw calls stay low and nearby corridors remain open.
   */
  public static placeDecomposedArchitecturalModels(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    placements: {
      key: 'big_building' | 'military_outpost';
      pos: [number, number, number];
      rotY: number;
      width: number;
    }[]
  ) {
    for (const p of placements) {
      const model = AssetLoader.cloneNormalizedModel(p.key, { targetWidth: p.width });
      if (!model) continue;

      model.position.set(p.pos[0], p.pos[1], p.pos[2]);
      model.rotation.y = p.rotY;
      scene.add(model);
      model.updateMatrixWorld(true);

      const rawBox = new THREE.Box3().setFromObject(model);
      // Shrink the AABB by 12% on X/Z so diagonal overhang eaves or porches never block adjacent walkways
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      rawBox.getSize(size);
      rawBox.getCenter(center);

      const halfX = size.x * 0.44;
      const halfZ = size.z * 0.44;
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(center.x - halfX, rawBox.min.y, center.z - halfZ),
          new THREE.Vector3(center.x + halfX, rawBox.max.y, center.z + halfZ)
        )
      );
    }
  }

  /**
   * Validates that no interactive pickup or explosive barrel is trapped inside a wall/building
   * collider; if a collision overlap is detected, automatically nudges it to a clear spot.
   */
  public static validateAndFixPlacements(
    colliders: THREE.Box3[],
    interactiveItems: InteractiveItem[],
    explosiveBarrels: ExplosiveBarrel[]
  ) {
    const isEmbeddedInWall = (pt: THREE.Vector3, ignoreBox?: THREE.Box3): THREE.Box3 | null => {
      for (const box of colliders) {
        if (ignoreBox && box === ignoreBox) continue;
        const height = box.max.y - box.min.y;
        // Only check tall wall/container colliders (ignore floor pads or desks under 1.2m)
        if (height < 1.25) continue;
        if (
          pt.x > box.min.x + 0.08 &&
          pt.x < box.max.x - 0.08 &&
          pt.z > box.min.z + 0.08 &&
          pt.z < box.max.z - 0.08 &&
          pt.y >= box.min.y &&
          pt.y <= box.max.y
        ) {
          return box;
        }
      }
      return null;
    };

    for (const item of interactiveItems) {
      if (item.type === 'door' || item.type === 'extraction' || item.type === 'breaker_box') continue;
      const hitBox = isEmbeddedInWall(item.position, item.colliderBox);
      if (hitBox) {
        // Nudge outside the wall toward the compound center
        const signX = item.position.x >= 0 ? -1 : 1;
        item.position.x = signX < 0 ? hitBox.min.x - 1.5 : hitBox.max.x + 1.5;
        item.mesh.position.x = item.position.x;
      }
    }

    for (const barrel of explosiveBarrels) {
      const hitBox = isEmbeddedInWall(barrel.position);
      if (hitBox) {
        const signX = barrel.position.x >= 0 ? -1 : 1;
        barrel.position.x = signX < 0 ? hitBox.min.x - 1.5 : hitBox.max.x + 1.5;
        barrel.mesh.position.x = barrel.position.x;
      }
    }
  }
}
