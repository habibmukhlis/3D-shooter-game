import * as THREE from 'three';
import { MissionId } from '../types/game';
import { TextureFactory } from './TextureFactory';

export interface InteractiveItem {
  id: string;
  type: 'ammo' | 'medkit' | 'briefcase' | 'alarm_console' | 'extraction' | 'generator' | 'radar_hack' | 'silo_override' | 'bunker_power';
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  isCollected?: boolean;
}

export interface ExplosiveBarrel {
  id: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  health: number;
  isExploded: boolean;
}

export interface SurveillanceCameraMesh {
  id: string;
  mount: THREE.Group;
  head: THREE.Group;
  lightCone: THREE.Mesh;
  light: THREE.SpotLight;
  baseAngle: number;
  sweepRange: number;
  isDestroyed: boolean;
}

export interface MapData {
  colliders: THREE.Box3[];
  interactiveItems: InteractiveItem[];
  explosiveBarrels: ExplosiveBarrel[];
  cameras: SurveillanceCameraMesh[];
  spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[];
  environmentType: 'night_depot' | 'daylight_radar' | 'mountain_dawn';
}

export class MapBuilder {
  public static buildCompound(scene: THREE.Scene, missionId: MissionId = 'mission_01'): MapData {
    if (missionId === 'mission_02') {
      return this.buildDaylightRadarMap(scene);
    } else if (missionId === 'mission_03') {
      return this.buildMountainDawnMap(scene);
    }
    return this.buildNightDepotMap(scene);
  }

  // =========================================================================
  // MISSION 01: NIGHT DEPOT (Cold War Supply Logistics)
  // =========================================================================
  private static buildNightDepotMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const groundTex = TextureFactory.getGroundTexture();
    const concreteTex = TextureFactory.getConcreteWallTexture();
    const metalSheetTex = TextureFactory.getWarehouseMetalTexture();
    const crateTex = TextureFactory.getCrateTexture();
    const helipadTex = TextureFactory.getHelipadTexture();

    const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.8, metalness: 0.1 });
    const warehouseMat = new THREE.MeshStandardMaterial({ map: metalSheetTex, roughness: 0.5, metalness: 0.6 });
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.7, metalness: 0.1 });
    const metalDarkMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.4, metalness: 0.8 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x6e3b2e, roughness: 0.85 });

    // 1. Ground Plane (200x200m)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
      }
    };

    // 2. Perimeter Walls (140x140m compound)
    const wallH = 4.5;
    const wallT = 1.2;
    const compSize = 140;
    const half = compSize / 2;

    // North, East, West Walls
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(compSize, wallH, wallT), concreteMat);
    northWall.position.set(0, wallH / 2, -half);
    scene.add(northWall);
    addCollider(northWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    eastWall.position.set(half, wallH / 2, 0);
    scene.add(eastWall);
    addCollider(eastWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    westWall.position.set(-half, wallH / 2, 0);
    scene.add(westWall);
    addCollider(westWall);

    // South Wall with gate gap
    const gateGap = 16;
    const segW = (compSize - gateGap) / 2;
    const southL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    southL.position.set(-segW / 2 - gateGap / 2, wallH / 2, half);
    scene.add(southL);
    addCollider(southL);

    const southR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    southR.position.set(segW / 2 + gateGap / 2, wallH / 2, half);
    scene.add(southR);
    addCollider(southR);

    // Gate Guard Shack
    const shack = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.5, 4.5), concreteMat);
    shack.position.set(gateGap / 2 + 3.2, 1.75, half - 3.2);
    scene.add(shack);
    addCollider(shack);

    // Boom barrier arm
    const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    boomArm.rotation.z = Math.PI / 2;
    boomArm.position.set(0, 1.1, half);
    scene.add(boomArm);
    addCollider(boomArm);

    // 3. Watchtowers (South-East & North-West)
    const tower1 = this.createWatchtower(scene, new THREE.Vector3(45, 0, 45), metalDarkMat);
    tower1.colliders.forEach(c => colliders.push(c));
    spotlights.push(tower1.spotlight);

    const tower2 = this.createWatchtower(scene, new THREE.Vector3(-45, 0, -45), metalDarkMat);
    tower2.colliders.forEach(c => colliders.push(c));
    spotlights.push(tower2.spotlight);

    // 4. Military Warehouse (X: -32, Z: 5)
    const warehouseCols = this.createWarehouse(scene, new THREE.Vector3(-32, 0, 5), warehouseMat, metalDarkMat);
    warehouseCols.forEach(c => colliders.push(c));

    // 5. Admin Building (X: 32, Z: -10)
    const adminCols = this.createAdminBuilding(scene, new THREE.Vector3(32, 0, -10), brickMat, concreteMat);
    adminCols.forEach(c => colliders.push(c));

    // 6. Helipad
    const helipadMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.8 }));
    helipadMesh.rotation.x = -Math.PI / 2;
    helipadMesh.position.set(0, 0.05, -48);
    helipadMesh.receiveShadow = true;
    scene.add(helipadMesh);

    // Helipad beacons
    const beaconGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    [[-11, -59], [11, -59], [-11, -37], [11, -37]].forEach(([bx, bz]) => {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(bx, 0.25, bz);
      scene.add(beacon);
      const bLight = new THREE.PointLight(0x22c55e, 1.5, 8);
      bLight.position.set(bx, 0.6, bz);
      scene.add(bLight);
    });

    // 7. Supply Crates
    const cratePlacements = [
      { pos: [0, 0, 15], size: [2, 2, 2] },
      { pos: [2.2, 0, 15], size: [2, 2, 2] },
      { pos: [1.1, 2, 15], size: [2, 2, 2] },
      { pos: [-10, 0, 25], size: [3, 2, 2] },
      { pos: [-10, 0, 27.5], size: [2, 2, 2] },
      { pos: [15, 0, 30], size: [2.5, 2, 2] },
      { pos: [15, 2, 30], size: [2, 2, 2] },
      { pos: [-14, 0, 12], size: [2.5, 2.5, 2.5] },
      { pos: [-14, 0, 15], size: [2.5, 2.5, 2.5] },
      { pos: [-14, 2.5, 13.5], size: [2, 2, 2] },
      { pos: [18, 0, -8], size: [2, 2, 2] },
      { pos: [18, 0, -11], size: [2, 2, 2] },
    ];
    cratePlacements.forEach((c) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.size[0], c.size[1], c.size[2]), crateMat);
      mesh.position.set(c.pos[0], c.pos[1] + c.size[1] / 2, c.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      addCollider(mesh);
    });

    // 8. Explosive Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.7 });
    const barrelPositions = [
      [-8, 0.65, 20],
      [-7.2, 0.65, 20.8],
      [12, 0.65, 28],
      [-18, 0.65, -8],
      [22, 0.65, -4],
      [5, 0.65, -28],
    ];
    barrelPositions.forEach((pos, idx) => {
      const mesh = new THREE.Mesh(barrelGeo, barrelMat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.castShadow = true;
      scene.add(mesh);
      addCollider(mesh);
      explosiveBarrels.push({
        id: `barrel_${idx}`,
        mesh,
        position: new THREE.Vector3(pos[0], pos[1], pos[2]),
        health: 30,
        isExploded: false,
      });
    });

    // 9. Interactive Mission Items
    // A. Intel Briefcase inside warehouse
    const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.45), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.8 }));
    briefcase.position.set(-32, 1.05, 10);
    scene.add(briefcase);
    interactiveItems.push({ id: 'briefcase', type: 'briefcase', position: briefcase.position.clone(), mesh: briefcase });

    // B. Alarm Terminal inside Admin office
    const alarmTerminal = this.createConsoleTerminal(scene, new THREE.Vector3(32, 0, -12), 0xef4444);
    colliders.push(alarmTerminal.box);
    interactiveItems.push({ id: 'alarm_console', type: 'alarm_console', position: new THREE.Vector3(32, 0.8, -12), mesh: alarmTerminal.mesh });

    // C. Ammo & Medkits
    this.addStandardPickups(scene, interactiveItems, [
      [2, 0.25, 40], [-22, 0.25, 12], [24, 0.25, -2], [45, 9.2, 45], [-45, 9.2, -45]
    ], [
      [-12, 0.25, 24], [34, 0.25, -6], [-30, 0.25, -8]
    ]);

    // D. Helipad Extraction Marker
    const extractRing = new THREE.Mesh(new THREE.RingGeometry(3, 3.4, 24), new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide }));
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.1, -48);
    scene.add(extractRing);
    interactiveItems.push({ id: 'extraction_zone', type: 'extraction', position: new THREE.Vector3(0, 0.5, -48), mesh: extractRing });

    // 10. Surveillance Cameras
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-17, 7, -15), -Math.PI / 4, 'cam_1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-17, 7, 25), Math.PI / 4, 'cam_2'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(22, 5, 2), Math.PI * 0.75, 'cam_3'));

    return { colliders, interactiveItems, explosiveBarrels, cameras, spotlights, environmentType: 'night_depot' };
  }

  // =========================================================================
  // MISSION 02: DAYLIGHT RADAR (Desert High-Noon Telemetry Array)
  // =========================================================================
  private static buildDaylightRadarMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const desertGroundTex = TextureFactory.getDesertGroundTexture();
    const concreteTex = TextureFactory.getConcreteWallTexture();
    const metalSheetTex = TextureFactory.getWarehouseMetalTexture();
    const crateTex = TextureFactory.getCrateTexture();

    const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.85, metalness: 0.1 });
    const metalMat = new THREE.MeshStandardMaterial({ map: metalSheetTex, roughness: 0.45, metalness: 0.7 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xa88358, roughness: 0.95 });
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.7 });

    // 1. Desert Terrain Ground (220x220m)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: desertGroundTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
      }
    };

    // 2. Concrete Desert Perimeter Walls (150x150m)
    const wallH = 4.2;
    const wallT = 1.2;
    const compSize = 150;
    const half = compSize / 2;

    // South wall with central desert gate
    const gateGap = 18;
    const segW = (compSize - gateGap) / 2;
    const southL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    southL.position.set(-segW / 2 - gateGap / 2, wallH / 2, half);
    scene.add(southL);
    addCollider(southL);

    const southR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    southR.position.set(segW / 2 + gateGap / 2, wallH / 2, half);
    scene.add(southR);
    addCollider(southR);

    // North wall with exit canyon gateway
    const northL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    northL.position.set(-segW / 2 - gateGap / 2, wallH / 2, -half);
    scene.add(northL);
    addCollider(northL);

    const northR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    northR.position.set(segW / 2 + gateGap / 2, wallH / 2, -half);
    scene.add(northR);
    addCollider(northR);

    // East and West perimeter walls
    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    eastWall.position.set(half, wallH / 2, 0);
    scene.add(eastWall);
    addCollider(eastWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    westWall.position.set(-half, wallH / 2, 0);
    scene.add(westWall);
    addCollider(westWall);

    // 3. Central Radar Control Complex (X: 18, Z: 10, Size: 32w x 26l x 6h)
    const radarComplexCols = this.createRadarControlComplex(scene, new THREE.Vector3(18, 0, 10), concreteMat, darkSteelMat);
    radarComplexCols.forEach(c => colliders.push(c));

    // Parabolic Satellite Dishes on Roof
    const dish1 = this.createParabolicDish(scene, new THREE.Vector3(12, 6.2, 10), 5.5, darkSteelMat);
    dish1.forEach(c => colliders.push(c));

    const dish2 = this.createParabolicDish(scene, new THREE.Vector3(26, 6.2, 10), 4.2, darkSteelMat);
    dish2.forEach(c => colliders.push(c));

    // 4. Power Generator Substation Enclosure (X: -28, Z: -18, Size: 22w x 20l)
    const generatorCols = this.createGeneratorStation(scene, new THREE.Vector3(-28, 0, -18), concreteMat, darkSteelMat);
    generatorCols.forEach(c => colliders.push(c));

    // Sabotage Interactive Console
    const genConsole = this.createConsoleTerminal(scene, new THREE.Vector3(-28, 0, -18), 0xf59e0b);
    colliders.push(genConsole.box);
    interactiveItems.push({
      id: 'obj_generator',
      type: 'generator',
      position: new THREE.Vector3(-28, 0.8, -18),
      mesh: genConsole.mesh,
    });

    // 5. Radar Telemetry Uplink Terminal inside the Radar Complex
    const uplinkConsole = this.createConsoleTerminal(scene, new THREE.Vector3(24, 0, 16), 0x06b6d4);
    colliders.push(uplinkConsole.box);
    interactiveItems.push({
      id: 'obj_radar_hack',
      type: 'radar_hack',
      position: new THREE.Vector3(24, 0.8, 16),
      mesh: uplinkConsole.mesh,
    });

    // 6. Communications Officer Bunker (X: 0, Z: -8)
    const officerBunker = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 14), concreteMat);
    officerBunker.position.set(0, 2.25, -8);
    scene.add(officerBunker);
    addCollider(officerBunker);

    // 7. Sandbag Trenches & Perimeter Bunkers
    const sandbagCoords = [
      [0, 0, 35], [-12, 0, 30], [12, 0, 30],
      [-5, 0, 6], [5, 0, 6],
      [-18, 0, 2], [-24, 0, 2],
      [-20, 0, -32], [15, 0, -32]
    ];
    sandbagCoords.forEach(([sx, sy, sz]) => {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.4), sandbagMat);
      bag.position.set(sx, sy + 0.55, sz);
      bag.castShadow = true;
      scene.add(bag);
      addCollider(bag);
    });

    // 8. Shipping Containers (Green & Rust Orange)
    const containerPlacements = [
      { pos: [-14, 0, 15], color: 0x15803d, rot: 0 },
      { pos: [-14, 2.8, 15], color: 0x15803d, rot: 0 },
      { pos: [34, 0, -8], color: 0xc2410c, rot: Math.PI / 6 },
      { pos: [-38, 0, 8], color: 0x1e3a8a, rot: -Math.PI / 8 },
      { pos: [0, 0, -28], color: 0xca8a04, rot: 0 },
    ];
    containerPlacements.forEach((c) => {
      const cont = new THREE.Mesh(
        new THREE.BoxGeometry(12, 2.8, 3.2),
        new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.6, metalness: 0.4 })
      );
      cont.position.set(c.pos[0], c.pos[1] + 1.4, c.pos[2]);
      cont.rotation.y = c.rot;
      cont.castShadow = true;
      scene.add(cont);
      addCollider(cont);
    });

    // 9. Desert Watchtowers with Snipers
    const tw1 = this.createWatchtower(scene, new THREE.Vector3(50, 0, 50), darkSteelMat);
    tw1.colliders.forEach(c => colliders.push(c));

    const tw2 = this.createWatchtower(scene, new THREE.Vector3(-50, 0, -50), darkSteelMat);
    tw2.colliders.forEach(c => colliders.push(c));

    // 10. Crates and Barrels
    for (let i = 0; i < 8; i++) {
      const bPos = [-20 + (i % 3) * 3, 0.65, -12 + Math.floor(i / 3) * 4];
      const bMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.7 })
      );
      bMesh.position.set(bPos[0], bPos[1], bPos[2]);
      scene.add(bMesh);
      addCollider(bMesh);
      explosiveBarrels.push({
        id: `barrel_radar_${i}`,
        mesh: bMesh,
        position: new THREE.Vector3(bPos[0], bPos[1], bPos[2]),
        health: 30,
        isExploded: false,
      });
    }

    // Pickups
    this.addStandardPickups(scene, interactiveItems, [
      [2, 0.25, 42], [-14, 0.25, 10], [28, 0.25, 20], [50, 9.2, 50]
    ], [
      [0, 0.25, 25], [16, 0.25, -2], [-26, 0.25, -24]
    ]);

    // Extraction marker at North Canyon Gate (Z: -55)
    const extractRing = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.0, 24), new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide }));
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.1, -55);
    scene.add(extractRing);
    interactiveItems.push({ id: 'extraction_zone', type: 'extraction', position: new THREE.Vector3(0, 0.5, -55), mesh: extractRing });

    // Cameras
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(10, 5, 22), 0, 'cam_r1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-20, 4.5, -12), Math.PI / 3, 'cam_r2'));

    return { colliders, interactiveItems, explosiveBarrels, cameras, spotlights, environmentType: 'daylight_radar' };
  }

  // =========================================================================
  // MISSION 03: MOUNTAIN DAWN (Subterranean Strategic Missile Complex)
  // =========================================================================
  private static buildMountainDawnMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const rockTex = TextureFactory.getMountainRockTexture();
    const concreteTex = TextureFactory.getConcreteWallTexture();
    const metalSheetTex = TextureFactory.getWarehouseMetalTexture();
    const helipadTex = TextureFactory.getHelipadTexture();

    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.9, metalness: 0.2 });
    const reinforcedConcreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.75, metalness: 0.2 });
    const heavySteelMat = new THREE.MeshStandardMaterial({ map: metalSheetTex, color: 0x334155, roughness: 0.35, metalness: 0.85 });

    // 1. Alpine Granite Bedrock Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), rockMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
      }
    };

    // 2. High Mountain Fortress Perimeter Bulwarks (Granite Terraces)
    const wallH = 6.0;
    const wallT = 2.0;
    const compSize = 150;
    const half = compSize / 2;

    const northW = new THREE.Mesh(new THREE.BoxGeometry(compSize, wallH, wallT), reinforcedConcreteMat);
    northW.position.set(0, wallH / 2, -half);
    scene.add(northW);
    addCollider(northW);

    const eastW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), reinforcedConcreteMat);
    eastW.position.set(half, wallH / 2, 0);
    scene.add(eastW);
    addCollider(eastW);

    const westW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), reinforcedConcreteMat);
    westW.position.set(-half, wallH / 2, 0);
    scene.add(westW);
    addCollider(westW);

    // South fortress gate
    const gateGap = 16;
    const segW = (compSize - gateGap) / 2;
    const southL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), reinforcedConcreteMat);
    southL.position.set(-segW / 2 - gateGap / 2, wallH / 2, half);
    scene.add(southL);
    addCollider(southL);

    const southR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), reinforcedConcreteMat);
    southR.position.set(segW / 2 + gateGap / 2, wallH / 2, half);
    scene.add(southR);
    addCollider(southR);

    // 3. Central Strategic Missile Silo Pit (Circular Shaft with blast doors)
    const siloRing = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 1.2, 32),
      heavySteelMat
    );
    siloRing.position.set(0, 0.6, 5);
    scene.add(siloRing);
    addCollider(siloRing);

    // Heavy Silo Blast Door Covers (Half-open)
    const door1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 8), heavySteelMat);
    door1.position.set(-4.5, 1.4, 5);
    scene.add(door1);
    addCollider(door1);

    const door2 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 8), heavySteelMat);
    door2.position.set(4.5, 1.4, 5);
    scene.add(door2);
    addCollider(door2);

    // 4. Subterranean Silo Command Bunker (West bunker, X: -30, Z: -2, Size: 24w x 26l x 5.5h)
    const bunkerCols = this.createCommandBunker(scene, new THREE.Vector3(-30, 0, -2), reinforcedConcreteMat, heavySteelMat);
    bunkerCols.forEach(c => colliders.push(c));

    // Silo Launch Override Terminal inside
    const siloConsole = this.createConsoleTerminal(scene, new THREE.Vector3(-30, 0, -2), 0xef4444);
    colliders.push(siloConsole.box);
    interactiveItems.push({
      id: 'obj_silo_override',
      type: 'silo_override',
      position: new THREE.Vector3(-30, 0.8, -2),
      mesh: siloConsole.mesh,
    });

    // 5. Eastern Substation Dynamo Pillbox (X: 32, Z: 22)
    const pillbox = new THREE.Mesh(new THREE.BoxGeometry(18, 4.5, 16), reinforcedConcreteMat);
    pillbox.position.set(32, 2.25, 22);
    scene.add(pillbox);
    addCollider(pillbox);

    const dynamoConsole = this.createConsoleTerminal(scene, new THREE.Vector3(32, 0, 22), 0xf59e0b);
    colliders.push(dynamoConsole.box);
    interactiveItems.push({
      id: 'obj_bunker_breach',
      type: 'bunker_power',
      position: new THREE.Vector3(32, 0.8, 22),
      mesh: dynamoConsole.mesh,
    });

    // 6. Base Commander Headquarters (X: 25, Z: -15)
    const hqBuilding = new THREE.Mesh(new THREE.BoxGeometry(22, 5.0, 20), reinforcedConcreteMat);
    hqBuilding.position.set(25, 2.5, -15);
    scene.add(hqBuilding);
    addCollider(hqBuilding);

    // 7. Mountain Terraced Rooftop Helipad (North Elevated Extraction, Z: -50)
    const helipadMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.8 }));
    helipadMesh.rotation.x = -Math.PI / 2;
    helipadMesh.position.set(0, 0.05, -50);
    helipadMesh.receiveShadow = true;
    scene.add(helipadMesh);

    const extractRing = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.0, 24), new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }));
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.1, -50);
    scene.add(extractRing);
    interactiveItems.push({ id: 'extraction_zone', type: 'extraction', position: new THREE.Vector3(0, 0.5, -50), mesh: extractRing });

    // 8. Elevated Mountain Sniper Towers
    const tw1 = this.createWatchtower(scene, new THREE.Vector3(45, 0, 45), heavySteelMat);
    tw1.colliders.forEach(c => colliders.push(c));
    spotlights.push(tw1.spotlight);

    const tw2 = this.createWatchtower(scene, new THREE.Vector3(-45, 0, -45), heavySteelMat);
    tw2.colliders.forEach(c => colliders.push(c));
    spotlights.push(tw2.spotlight);

    // Pickups
    this.addStandardPickups(scene, interactiveItems, [
      [2, 0.25, 40], [-18, 0.25, 14], [25, 0.25, 8], [45, 9.2, 45]
    ], [
      [0, 0.25, 22], [28, 0.25, -6], [-28, 0.25, -12]
    ]);

    // Red explosive barrels
    [[-12, 0.65, 18], [15, 0.65, 14], [-8, 0.65, -15], [18, 0.65, -8]].forEach((pos, idx) => {
      const bMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.7 })
      );
      bMesh.position.set(pos[0], pos[1], pos[2]);
      scene.add(bMesh);
      addCollider(bMesh);
      explosiveBarrels.push({
        id: `barrel_silo_${idx}`,
        mesh: bMesh,
        position: new THREE.Vector3(pos[0], pos[1], pos[2]),
        health: 30,
        isExploded: false,
      });
    });

    // Surveillance Cameras
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-18, 5, 10), -Math.PI / 4, 'cam_m1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(15, 5, -5), Math.PI / 2, 'cam_m2'));

    return { colliders, interactiveItems, explosiveBarrels, cameras, spotlights, environmentType: 'mountain_dawn' };
  }

  // =========================================================================
  // HELPER GEOMETRIES & STRUCTURES
  // =========================================================================

  private static createWatchtower(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    metalMat: THREE.Material
  ) {
    const colliders: THREE.Box3[] = [];
    const towerGroup = new THREE.Group();
    towerGroup.position.copy(pos);

    const legH = 9;
    const legGeo = new THREE.BoxGeometry(0.35, legH, 0.35);
    const legSpacing = 2.4;

    [
      [-legSpacing, -legSpacing],
      [legSpacing, -legSpacing],
      [-legSpacing, legSpacing],
      [legSpacing, legSpacing],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(lx, legH / 2, lz);
      towerGroup.add(leg);
    });

    const plat = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 6), metalMat);
    plat.position.set(0, legH, 0);
    towerGroup.add(plat);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 6.6), metalMat);
    roof.position.set(0, legH + 2.8, 0);
    towerGroup.add(roof);

    scene.add(towerGroup);

    // Solid base collider
    colliders.push(new THREE.Box3(
      new THREE.Vector3(pos.x - 3.2, pos.y, pos.z - 3.2),
      new THREE.Vector3(pos.x + 3.2, pos.y + 0.6, pos.z + 3.2)
    ));

    // Spotlight
    const spotlight = new THREE.SpotLight(0xfff7ed, 3.5, 55, Math.PI / 6, 0.4, 1.2);
    spotlight.position.set(pos.x, pos.y + legH + 1, pos.z);
    spotlight.castShadow = true;
    scene.add(spotlight);

    const targetObj = new THREE.Object3D();
    targetObj.position.set(pos.x + 20, 0, pos.z + 20);
    scene.add(targetObj);
    spotlight.target = targetObj;

    return {
      colliders,
      spotlight: {
        light: spotlight,
        target: targetObj,
        baseAngle: Math.random() * Math.PI * 2,
        sweepSpeed: 0.4,
      },
    };
  }

  private static createWarehouse(scene: THREE.Scene, pos: THREE.Vector3, wallMat: THREE.Material, metalMat: THREE.Material): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 30;
    const l = 42;
    const h = 8.5;

    // West, North, South Walls
    const westW = new THREE.Mesh(new THREE.BoxGeometry(1, h, l), wallMat);
    westW.position.set(pos.x - w / 2, h / 2, pos.z);
    scene.add(westW);
    colliders.push(new THREE.Box3().setFromObject(westW));

    const northW = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), wallMat);
    northW.position.set(pos.x, h / 2, pos.z - l / 2);
    scene.add(northW);
    colliders.push(new THREE.Box3().setFromObject(northW));

    const southW = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), wallMat);
    southW.position.set(pos.x, h / 2, pos.z + l / 2);
    scene.add(southW);
    colliders.push(new THREE.Box3().setFromObject(southW));

    // East Wall with 12m roll-up door
    const segL = (l - 12) / 2;
    const eastSeg1 = new THREE.Mesh(new THREE.BoxGeometry(1, h, segL), wallMat);
    eastSeg1.position.set(pos.x + w / 2, h / 2, pos.z - l / 2 + segL / 2);
    scene.add(eastSeg1);
    colliders.push(new THREE.Box3().setFromObject(eastSeg1));

    const eastSeg2 = new THREE.Mesh(new THREE.BoxGeometry(1, h, segL), wallMat);
    eastSeg2.position.set(pos.x + w / 2, h / 2, pos.z + l / 2 - segL / 2);
    scene.add(eastSeg2);
    colliders.push(new THREE.Box3().setFromObject(eastSeg2));

    // Sloped Metal Gabled Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.4, l + 1), metalMat);
    roof.position.set(pos.x, h + 0.2, pos.z);
    scene.add(roof);

    // Logistics desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    desk.position.set(pos.x, 0.45, pos.z + 10);
    scene.add(desk);
    colliders.push(new THREE.Box3().setFromObject(desk));

    return colliders;
  }

  private static createAdminBuilding(scene: THREE.Scene, pos: THREE.Vector3, brickMat: THREE.Material, roofMat: THREE.Material): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 20;
    const l = 24;
    const h = 4.8;

    const east = new THREE.Mesh(new THREE.BoxGeometry(1, h, l), brickMat);
    east.position.set(pos.x + w / 2, h / 2, pos.z);
    scene.add(east);
    colliders.push(new THREE.Box3().setFromObject(east));

    const north = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), brickMat);
    north.position.set(pos.x, h / 2, pos.z - l / 2);
    scene.add(north);
    colliders.push(new THREE.Box3().setFromObject(north));

    const south = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), brickMat);
    south.position.set(pos.x, h / 2, pos.z + l / 2);
    scene.add(south);
    colliders.push(new THREE.Box3().setFromObject(south));

    const westSegL = (l - 4) / 2;
    const west1 = new THREE.Mesh(new THREE.BoxGeometry(1, h, westSegL), brickMat);
    west1.position.set(pos.x - w / 2, h / 2, pos.z - l / 2 + westSegL / 2);
    scene.add(west1);
    colliders.push(new THREE.Box3().setFromObject(west1));

    const west2 = new THREE.Mesh(new THREE.BoxGeometry(1, h, westSegL), brickMat);
    west2.position.set(pos.x - w / 2, h / 2, pos.z + l / 2 - westSegL / 2);
    scene.add(west2);
    colliders.push(new THREE.Box3().setFromObject(west2));

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.4, l + 1), roofMat);
    roof.position.set(pos.x, h + 0.2, pos.z);
    scene.add(roof);

    return colliders;
  }

  private static createRadarControlComplex(scene: THREE.Scene, pos: THREE.Vector3, wallMat: THREE.Material, steelMat: THREE.Material): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 32;
    const l = 26;
    const h = 6.0;

    // Building box with interior doorway
    const north = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), wallMat);
    north.position.set(pos.x, h / 2, pos.z - l / 2);
    scene.add(north);
    colliders.push(new THREE.Box3().setFromObject(north));

    const east = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, l), wallMat);
    east.position.set(pos.x + w / 2, h / 2, pos.z);
    scene.add(east);
    colliders.push(new THREE.Box3().setFromObject(east));

    const west = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, l), wallMat);
    west.position.set(pos.x - w / 2, h / 2, pos.z);
    scene.add(west);
    colliders.push(new THREE.Box3().setFromObject(west));

    // South wall with entrance
    const doorW = 5;
    const sideW = (w - doorW) / 2;
    const south1 = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, 1.2), wallMat);
    south1.position.set(pos.x - w / 2 + sideW / 2, h / 2, pos.z + l / 2);
    scene.add(south1);
    colliders.push(new THREE.Box3().setFromObject(south1));

    const south2 = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, 1.2), wallMat);
    south2.position.set(pos.x + w / 2 - sideW / 2, h / 2, pos.z + l / 2);
    scene.add(south2);
    colliders.push(new THREE.Box3().setFromObject(south2));

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, l + 1), steelMat);
    roof.position.set(pos.x, h + 0.25, pos.z);
    scene.add(roof);

    return colliders;
  }

  private static createParabolicDish(scene: THREE.Scene, pos: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const dishGroup = new THREE.Group();
    dishGroup.position.copy(pos);

    // Mount pedestal
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 3, 12), mat);
    pedestal.position.set(0, 1.5, 0);
    dishGroup.add(pedestal);

    // Concave dish dish
    const dishMesh = new THREE.Mesh(
      new THREE.ConeGeometry(radius, 1.8, 24, 1, true),
      mat
    );
    dishMesh.rotation.x = Math.PI * 0.7; // Tilted toward sky
    dishMesh.position.set(0, 3.8, 0);
    dishGroup.add(dishMesh);

    scene.add(dishGroup);

    colliders.push(new THREE.Box3().setFromObject(dishGroup));
    return colliders;
  }

  private static createGeneratorStation(scene: THREE.Scene, pos: THREE.Vector3, concreteMat: THREE.Material, steelMat: THREE.Material): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 22;
    const l = 20;

    // Fenced concrete barrier walls around transformers
    const wallH = 3.2;
    const north = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.8), concreteMat);
    north.position.set(pos.x, wallH / 2, pos.z - l / 2);
    scene.add(north);
    colliders.push(new THREE.Box3().setFromObject(north));

    const east = new THREE.Mesh(new THREE.BoxGeometry(0.8, wallH, l), concreteMat);
    east.position.set(pos.x + w / 2, wallH / 2, pos.z);
    scene.add(east);
    colliders.push(new THREE.Box3().setFromObject(east));

    const west = new THREE.Mesh(new THREE.BoxGeometry(0.8, wallH, l), concreteMat);
    west.position.set(pos.x - w / 2, wallH / 2, pos.z);
    scene.add(west);
    colliders.push(new THREE.Box3().setFromObject(west));

    // Two big electrical transformer generators
    [-4, 4].forEach((ox) => {
      const trans = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.8, 5.5), steelMat);
      trans.position.set(pos.x + ox, 1.9, pos.z);
      scene.add(trans);
      colliders.push(new THREE.Box3().setFromObject(trans));
    });

    return colliders;
  }

  private static createCommandBunker(scene: THREE.Scene, pos: THREE.Vector3, concreteMat: THREE.Material, steelMat: THREE.Material): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 24;
    const l = 26;
    const h = 5.5;

    const bunker = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), concreteMat);
    bunker.position.set(pos.x, h / 2, pos.z);
    scene.add(bunker);
    colliders.push(new THREE.Box3().setFromObject(bunker));

    return colliders;
  }

  private static createConsoleTerminal(scene: THREE.Scene, pos: THREE.Vector3, screenColor: number) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.9), bodyMat);
    desk.position.y = 0.425;
    group.add(desk);

    const screenMat = new THREE.MeshBasicMaterial({ color: screenColor });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.08), screenMat);
    screen.position.set(0, 1.1, -0.2);
    screen.rotation.x = -0.2;
    group.add(screen);

    const pLight = new THREE.PointLight(screenColor, 1.2, 4);
    pLight.position.set(0, 1.2, 0.2);
    group.add(pLight);

    scene.add(group);

    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    return { mesh: group, box };
  }

  private static createSurveillanceCamera(scene: THREE.Scene, pos: THREE.Vector3, baseAngle: number, id: string): SurveillanceCameraMesh {
    const mount = new THREE.Group();
    mount.position.copy(pos);

    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), bracketMat);
    mount.add(bracket);

    const head = new THREE.Group();
    head.position.set(0, 0, 0.3);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.8), bodyMat);
    head.add(camBody);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    led.position.set(0.12, 0.12, 0.4);
    head.add(led);

    const coneGeo = new THREE.ConeGeometry(3.5, 12, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, 0, 6);
    head.add(cone);

    const light = new THREE.SpotLight(0xef4444, 2.5, 20, Math.PI / 6, 0.3, 1.5);
    light.position.set(0, 0, 0.4);
    head.add(light);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, 0, 10);
    head.add(targetObj);
    light.target = targetObj;

    mount.add(head);
    mount.rotation.y = baseAngle;
    scene.add(mount);

    return { id, mount, head, lightCone: cone, light, baseAngle, sweepRange: Math.PI / 3, isDestroyed: false };
  }

  private static addStandardPickups(scene: THREE.Scene, items: InteractiveItem[], ammoPos: number[][], medPos: number[][]) {
    ammoPos.forEach((pos, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), new THREE.MeshStandardMaterial({ color: 0x15803d, metalness: 0.5 }));
      box.position.set(pos[0], pos[1], pos[2]);
      scene.add(box);
      items.push({ id: `ammo_${i}`, type: 'ammo', position: new THREE.Vector3(pos[0], pos[1], pos[2]), mesh: box });
    });

    medPos.forEach((pos, i) => {
      const medGroup = new THREE.Group();
      const medBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
      medGroup.add(medBox);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.08), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      crossH.position.y = 0.13;
      medGroup.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.25), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      crossV.position.y = 0.13;
      medGroup.add(crossV);
      medGroup.position.set(pos[0], pos[1], pos[2]);
      scene.add(medGroup);
      items.push({ id: `medkit_${i}`, type: 'medkit', position: new THREE.Vector3(pos[0], pos[1], pos[2]), mesh: medGroup });
    });
  }
}
