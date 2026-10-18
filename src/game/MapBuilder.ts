import * as THREE from 'three';
import { EnvironmentType, MissionId } from '../types/game';
import { AssetLoader } from './AssetLoader';
import { TextureFactory } from './TextureFactory';
import { BuildingKit, BuildingOutput } from './world/BuildingKit';
import { PropKit } from './world/PropKit';

export interface InteractiveItem {
  id: string;
  type:
    | 'ammo'
    | 'medkit'
    | 'briefcase'
    | 'alarm_console'
    | 'extraction'
    | 'generator'
    | 'radar_hack'
    | 'silo_override'
    | 'bunker_power'
    | 'door'
    | 'locker'
    | 'breaker_box'
    | 'keycard'
    | 'c4_target';
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  isCollected?: boolean;
  isOpen?: boolean;
  isLocked?: boolean;
  hingeGroup?: THREE.Group;
  baseRotY?: number;
  colliderBox?: THREE.Box3;
  label?: string;
}

export interface ExplosiveBarrel {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  health: number;
  isExploded: boolean;
}

export interface BreakableProp {
  id: string;
  kind: 'window' | 'crate';
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  box: THREE.Box3;
  health: number;
  isBroken: boolean;
  spawnsPickup?: 'ammo' | 'medkit';
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

export interface LadderZone {
  id: string;
  box: THREE.Box3;
  topY: number;
}

export interface ExtractionHelicopter {
  group: THREE.Group;
  rotor: THREE.Object3D;
  tailRotor: THREE.Object3D;
  basePos: THREE.Vector3;
}

export interface MapData {
  colliders: THREE.Box3[];
  interactiveItems: InteractiveItem[];
  explosiveBarrels: ExplosiveBarrel[];
  breakableProps: BreakableProp[];
  compoundLights: THREE.Light[];
  powerCut: boolean;
  cameras: SurveillanceCameraMesh[];
  spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[];
  ladders: LadderZone[];
  extractionHeli?: ExtractionHelicopter;
  environmentType: EnvironmentType;
}

export class MapBuilder {
  public static buildCompound(scene: THREE.Scene, missionId: MissionId = 'mission_01'): MapData {
    if (missionId === 'mission_02') {
      return this.buildDaylightRadarMap(scene);
    } else if (missionId === 'mission_03') {
      return this.buildMountainDawnMap(scene);
    } else if (missionId === 'mission_04') {
      return this.buildHarborStormMap(scene);
    }
    return this.buildNightDepotMap(scene);
  }

  private static mergeBuildingOutput(
    out: BuildingOutput,
    colliders: THREE.Box3[],
    interactiveItems: InteractiveItem[],
    breakableProps: BreakableProp[],
    compoundLights: THREE.Light[]
  ) {
    out.colliders.forEach((c) => colliders.push(c));
    out.interactiveItems.forEach((i) => interactiveItems.push(i));
    out.breakableProps.forEach((b) => breakableProps.push(b));
    out.lights.forEach((l) => compoundLights.push(l));
  }

  // =========================================================================
  // MISSION 01: NIGHT DEPOT (Rebuilt Main Map - Cold War Supply Logistics)
  // =========================================================================
  private static buildNightDepotMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const breakableProps: BreakableProp[] = [];
    const compoundLights: THREE.Light[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const ladders: LadderZone[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const helipadTex = TextureFactory.getHelipadTexture();
    const concreteMat = TextureFactory.getConcreteMaterial();
    const warehouseMat = TextureFactory.getWarehouseMaterial();
    const groundMat = TextureFactory.getGroundMaterial('night_depot');
    const metalDarkMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.4, metalness: 0.8 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x6e3b2e, roughness: 0.85 });

    // 1. Ground Plane (240x240m) + Compound Road Network
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    PropKit.addCompoundRoads(scene, [
      { x: 0, z: 6, width: 7.5, length: 96, axis: 'z' },
      { x: 11, z: -8, width: 6.0, length: 20, axis: 'x' },
      { x: -10, z: 5, width: 6.5, length: 16, axis: 'x' },
    ]);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        colliders.push(new THREE.Box3().setFromObject(mesh));
      }
    };

    // 2. Perimeter Walls (140x140m compound)
    const wallH = 4.5;
    const wallT = 1.2;
    const compSize = 140;
    const half = compSize / 2;

    const northWall = new THREE.Mesh(new THREE.BoxGeometry(compSize, wallH, wallT), concreteMat);
    northWall.position.set(0, wallH / 2, -half);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    scene.add(northWall);
    addCollider(northWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    eastWall.position.set(half, wallH / 2, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    scene.add(eastWall);
    addCollider(eastWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    westWall.position.set(-half, wallH / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    scene.add(westWall);
    addCollider(westWall);

    // South Wall with gate gap
    const gateGap = 16;
    const segW = (compSize - gateGap) / 2;
    const southL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    southL.position.set(-segW / 2 - gateGap / 2, wallH / 2, half);
    southL.castShadow = true;
    southL.receiveShadow = true;
    scene.add(southL);
    addCollider(southL);

    const southR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    southR.position.set(segW / 2 + gateGap / 2, wallH / 2, half);
    southR.castShadow = true;
    southR.receiveShadow = true;
    scene.add(southR);
    addCollider(southR);

    // Gate Checkpoint Guard Tower + Boom Barrier
    this.placeGuardCheckpoint(scene, colliders, new THREE.Vector3(gateGap / 2 + 4.2, 0, half - 4.2), concreteMat);

    const boomArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    boomArm.rotation.z = Math.PI / 2;
    boomArm.position.set(-2.5, 1.1, half);
    scene.add(boomArm);
    addCollider(boomArm);

    // 3. Watchtowers (South-East & North-West) with Climbable Ladders
    const tower1 = this.createWatchtower(scene, new THREE.Vector3(45, 0, 45), metalDarkMat, 'ladder_se_1');
    tower1.colliders.forEach((c) => colliders.push(c));
    ladders.push(tower1.ladder);
    spotlights.push(tower1.spotlight);

    const tower2 = this.createWatchtower(scene, new THREE.Vector3(-45, 0, -45), metalDarkMat, 'ladder_nw_1');
    tower2.colliders.forEach((c) => colliders.push(c));
    ladders.push(tower2.ladder);
    spotlights.push(tower2.spotlight);

    // 4. Enterable Multi-Bay Logistics Warehouse (X: -32, Z: 5, spans X: -47..-17, Z: -16..26)
    const whOut = BuildingKit.createEnterableWarehouse(
      scene,
      new THREE.Vector3(-32, 0, 5),
      warehouseMat,
      metalDarkMat
    );
    this.mergeBuildingOutput(whOut, colliders, interactiveItems, breakableProps, compoundLights);

    // Warehouse interior shelving aisles with destructible wooden crates
    PropKit.addWarehouseShelvingRacks(
      scene,
      colliders,
      breakableProps,
      [
        [-25, 0, -6],
        [-25, 0, 14],
      ],
      'wh_rack'
    );

    // 5. Two-Story Enterable Administration & Security Building (X: 32, Z: -10, spans X: 22..42, Z: -22..2)
    const adminOut = BuildingKit.createTwoStoryAdminBuilding(
      scene,
      new THREE.Vector3(32, 0, -10),
      brickMat,
      concreteMat
    );
    this.mergeBuildingOutput(adminOut, colliders, interactiveItems, breakableProps, compoundLights);

    // 6. Decomposed Architectural Outpost & Northern Barracks + Fuel Depot
    PropKit.placeDecomposedArchitecturalModels(scene, colliders, [
      { key: 'military_outpost', pos: [35, 0, -34], rotY: 0, width: 13 },
      { key: 'big_building', pos: [-35, 0, -36], rotY: Math.PI / 2, width: 16 },
    ]);

    PropKit.addFuelDepotManifold(scene, colliders, interactiveItems, new THREE.Vector3(-22, 0, -34), false);

    // 7. Compound Floodlight Poles (linked to Breaker Box)
    PropKit.addFloodlightPoles(scene, colliders, compoundLights, [
      [-6, 0, 38],
      [6, 0, 12],
      [-6, 0, -14],
      [18, 0, -24],
    ]);

    // 8. Shipping Containers & M923 Military Trucks (Non-overlapping Motor Pool & Courtyard positions)
    this.placeShippingContainers(scene, colliders, [
      { pos: [-8, 0, -28], color: 0x15803d, rot: 0 },
      { pos: [14, 0, 20], color: 0x1e3a8a, rot: Math.PI / 2 },
    ]);

    this.placeMilitaryTrucks(scene, colliders, [
      { pos: [11, 0, 34], rotY: -Math.PI / 6 },
      { pos: [-6, 0, -18], rotY: Math.PI / 6 },
    ]);

    // 9. Helipad & UH-60A BlackHawk Extraction Helicopter
    const helipadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.8 })
    );
    helipadMesh.rotation.x = -Math.PI / 2;
    helipadMesh.position.set(0, 0.05, -48);
    helipadMesh.receiveShadow = true;
    scene.add(helipadMesh);

    const beaconGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    [
      [-11, -59],
      [11, -59],
      [-11, -37],
      [11, -37],
    ].forEach(([bx, bz]) => {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(bx, 0.25, bz);
      scene.add(beacon);
      const bLight = new THREE.PointLight(0x22c55e, 1.5, 8);
      bLight.position.set(bx, 0.6, bz);
      scene.add(bLight);
    });

    const extractionHeli = this.createExtractionHelicopter(scene, new THREE.Vector3(0, 0.08, -53.5), Math.PI / 6);

    // 10. Supply Crates & Cardboard Boxes (Clean tactical cover clusters)
    const cratePlacements = [
      { pos: [0, 0, 15], size: [2, 2, 2] },
      { pos: [2.2, 0, 15], size: [2, 2, 2] },
      { pos: [1.1, 2, 15], size: [2, 2, 2] },
      { pos: [-10, 0, 25], size: [3, 2, 2] },
      { pos: [-10, 0, 27.5], size: [2, 2, 2] },
      { pos: [15, 0, 30], size: [2.5, 2, 2] },
      { pos: [-12, 0, 12], size: [2.2, 2.2, 2.2] },
      { pos: [-12, 0, 15], size: [2.2, 2.2, 2.2] },
      { pos: [17, 0, -8], size: [2, 2, 2] },
      { pos: [17, 0, -11], size: [2, 2, 2] },
    ];
    this.placeSupplyCrates(scene, colliders, cratePlacements);

    // 11. Explosive Barrels (All outside walls with clear sightlines)
    const barrelPositions = [
      [-8, 0, 20],
      [-7.1, 0, 20.8],
      [12, 0, 28],
      [-14, 0, -8],
      [18.5, 0, -4],
      [5, 0, -28],
    ];
    this.placeExplosiveBarrels(scene, colliders, explosiveBarrels, barrelPositions, 'barrel');

    // 12. Interactive Mission Objectives & Pickups
    const briefcase = this.createBriefcaseProp(scene, new THREE.Vector3(-32, 1.05, 10));
    interactiveItems.push({
      id: 'briefcase',
      type: 'briefcase',
      position: briefcase.position.clone(),
      mesh: briefcase,
    });

    const alarmTerminal = this.createConsoleTerminal(scene, new THREE.Vector3(32, 0, -14), 0xef4444);
    colliders.push(alarmTerminal.box);
    interactiveItems.push({
      id: 'alarm_console',
      type: 'alarm_console',
      position: new THREE.Vector3(32, 0.8, -14),
      mesh: alarmTerminal.mesh,
    });

    this.addStandardPickups(
      scene,
      interactiveItems,
      [
        [2, 0.25, 42],
        [-20, 0.25, 6],
        [26, 0.25, -4],
        [45, 9.2, 45],
        [-45, 9.2, -45],
      ],
      [
        [-10, 0.25, 22],
        [35, 0.25, -5],
        [-30, 0.25, -2],
      ]
    );

    const extractRing = new THREE.Mesh(
      new THREE.RingGeometry(3, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide })
    );
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.1, -48);
    scene.add(extractRing);
    interactiveItems.push({
      id: 'extraction_zone',
      type: 'extraction',
      position: new THREE.Vector3(0, 0.5, -48),
      mesh: extractRing,
    });

    // 13. Surveillance Cameras
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-16.4, 6.5, -14), -Math.PI / 4, 'cam_1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-16.4, 6.5, 24), Math.PI / 4, 'cam_2'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(21.4, 5.2, 1.5), Math.PI * 0.75, 'cam_3'));

    // 14. Perimeter Trees, Rocks & Distant Mountains
    this.addEnvironmentVista(scene, colliders, 'night_depot');

    // 15. Validate & auto-fix any overlapping prop placements
    PropKit.validateAndFixPlacements(colliders, interactiveItems, explosiveBarrels);

    return {
      colliders,
      interactiveItems,
      explosiveBarrels,
      breakableProps,
      compoundLights,
      powerCut: false,
      cameras,
      spotlights,
      ladders,
      extractionHeli,
      environmentType: 'night_depot',
    };
  }

  // =========================================================================
  // MISSION 02: DAYLIGHT RADAR (Desert High-Noon Telemetry Array)
  // =========================================================================
  private static buildDaylightRadarMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const breakableProps: BreakableProp[] = [];
    const compoundLights: THREE.Light[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const ladders: LadderZone[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const concreteMat = TextureFactory.getConcreteMaterial();
    const groundMat = TextureFactory.getGroundMaterial('daylight_radar');
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xa88358, roughness: 0.95 });

    // 1. Desert Terrain Ground (240x240m) + Tracks
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    PropKit.addCompoundRoads(scene, [
      { x: 0, z: 0, width: 7.0, length: 105, axis: 'z' },
      { x: 10, z: 10, width: 6.0, length: 24, axis: 'x' },
    ]);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        colliders.push(new THREE.Box3().setFromObject(mesh));
      }
    };

    // 2. Concrete Desert Perimeter Walls (150x150m)
    const wallH = 4.2;
    const wallT = 1.2;
    const compSize = 150;
    const half = compSize / 2;

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

    const northL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    northL.position.set(-segW / 2 - gateGap / 2, wallH / 2, -half);
    scene.add(northL);
    addCollider(northL);

    const northR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), concreteMat);
    northR.position.set(segW / 2 + gateGap / 2, wallH / 2, -half);
    scene.add(northR);
    addCollider(northR);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    eastWall.position.set(half, wallH / 2, 0);
    scene.add(eastWall);
    addCollider(eastWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    westWall.position.set(-half, wallH / 2, 0);
    scene.add(westWall);
    addCollider(westWall);

    this.placeGuardCheckpoint(scene, colliders, new THREE.Vector3(gateGap / 2 + 4.2, 0, half - 4.2), concreteMat);

    // 3. Central Radar Control Complex (X: 18, Z: 10)
    const radarComplexCols = this.createRadarControlComplex(scene, new THREE.Vector3(18, 0, 10), concreteMat, darkSteelMat);
    radarComplexCols.forEach((c) => colliders.push(c));

    const dish1 = this.createParabolicDish(scene, new THREE.Vector3(12, 6.2, 10), 5.5, darkSteelMat);
    dish1.forEach((c) => colliders.push(c));

    const dish2 = this.createParabolicDish(scene, new THREE.Vector3(26, 6.2, 10), 4.2, darkSteelMat);
    dish2.forEach((c) => colliders.push(c));

    // 4. Power Generator Substation Enclosure (X: -28, Z: -18)
    const generatorCols = this.createGeneratorStation(scene, new THREE.Vector3(-28, 0, -18), concreteMat, darkSteelMat);
    generatorCols.forEach((c) => colliders.push(c));

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

    // 6. Communications Officer Command Outpost
    PropKit.placeDecomposedArchitecturalModels(scene, colliders, [
      { key: 'military_outpost', pos: [0, 0, -18], rotY: 0, width: 14 },
      { key: 'big_building', pos: [-38, 0, 28], rotY: Math.PI / 2, width: 17 },
    ]);

    // Interactive supply lockers inside Radar Complex
    const radarLockerOut: BuildingOutput = { colliders: [], interactiveItems: [], breakableProps: [], lights: [] };
    BuildingKit.addSupplyLocker(scene, radarLockerOut, new THREE.Vector3(31, 0, 4), -Math.PI / 2, 'locker_radar_1');
    BuildingKit.addSupplyLocker(scene, radarLockerOut, new THREE.Vector3(-20, 0, -25), 0, 'locker_radar_2');
    this.mergeBuildingOutput(radarLockerOut, colliders, interactiveItems, breakableProps, compoundLights);

    // 7. Sandbag Trenches & Concrete Fences
    const sandbagCoords = [
      [0, 0, 35],
      [-12, 0, 30],
      [12, 0, 30],
      [-5, 0, 6],
      [5, 0, 6],
      [-18, 0, 2],
      [-24, 0, 2],
      [-20, 0, -32],
      [15, 0, -32],
    ];
    sandbagCoords.forEach(([sx, sy, sz]) => {
      const fenceClone = AssetLoader.cloneNormalizedModel('concrete_fences', { targetWidth: 4.2 });
      if (fenceClone) {
        fenceClone.position.set(sx, sy, sz);
        scene.add(fenceClone);
        addCollider(fenceClone);
      } else {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.4), sandbagMat);
        bag.position.set(sx, sy + 0.55, sz);
        bag.castShadow = true;
        scene.add(bag);
        addCollider(bag);
      }
    });

    // 8. 3D Shipping Containers & M923 Military Trucks
    this.placeShippingContainers(scene, colliders, [
      { pos: [-14, 0, 15], color: 0x15803d, rot: 0 },
      { pos: [36, 0, -10], color: 0xc2410c, rot: Math.PI / 6 },
      { pos: [-38, 0, 4], color: 0x1e3a8a, rot: -Math.PI / 8 },
      { pos: [0, 0, -32], color: 0xca8a04, rot: 0 },
    ]);

    this.placeMilitaryTrucks(scene, colliders, [
      { pos: [14, 0, -22], rotY: Math.PI / 3 },
      { pos: [-16, 0, 32], rotY: -Math.PI / 4 },
    ]);

    // 9. Desert Watchtowers with Snipers & Ladders
    const tw1 = this.createWatchtower(scene, new THREE.Vector3(50, 0, 50), darkSteelMat, 'ladder_se_2');
    tw1.colliders.forEach((c) => colliders.push(c));
    ladders.push(tw1.ladder);

    const tw2 = this.createWatchtower(scene, new THREE.Vector3(-50, 0, -50), darkSteelMat, 'ladder_nw_2');
    tw2.colliders.forEach((c) => colliders.push(c));
    ladders.push(tw2.ladder);

    // 10. Barrels & Pickups
    const radarBarrelCoords: number[][] = [];
    for (let i = 0; i < 6; i++) {
      radarBarrelCoords.push([-14 + (i % 2) * 2.5, 0, -8 + Math.floor(i / 2) * 3.5]);
    }
    this.placeExplosiveBarrels(scene, colliders, explosiveBarrels, radarBarrelCoords, 'barrel_radar');

    this.addStandardPickups(
      scene,
      interactiveItems,
      [
        [2, 0.25, 42],
        [-14, 0.25, 10],
        [28, 0.25, 20],
        [50, 9.2, 50],
      ],
      [
        [0, 0.25, 25],
        [16, 0.25, -4],
        [-26, 0.25, -24],
      ]
    );

    const extractRing = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 4.0, 24),
      new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide })
    );
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.1, -55);
    scene.add(extractRing);
    interactiveItems.push({
      id: 'extraction_zone',
      type: 'extraction',
      position: new THREE.Vector3(0, 0.5, -55),
      mesh: extractRing,
    });

    const extractionHeli = this.createExtractionHelicopter(scene, new THREE.Vector3(0, 0.08, -61), 0);

    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(2, 6, 10), -Math.PI / 2, 'cam_radar_1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-17, 5, -18), Math.PI / 4, 'cam_radar_2'));

    this.addEnvironmentVista(scene, colliders, 'daylight_radar');
    PropKit.validateAndFixPlacements(colliders, interactiveItems, explosiveBarrels);

    return {
      colliders,
      interactiveItems,
      explosiveBarrels,
      breakableProps,
      compoundLights,
      powerCut: false,
      cameras,
      spotlights,
      ladders,
      extractionHeli,
      environmentType: 'daylight_radar',
    };
  }

  // =========================================================================
  // MISSION 03: MOUNTAIN DAWN (Alpine Strategic Missile Silo Stronghold)
  // =========================================================================
  private static buildMountainDawnMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const breakableProps: BreakableProp[] = [];
    const compoundLights: THREE.Light[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const ladders: LadderZone[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const helipadTex = TextureFactory.getHelipadTexture();
    const concreteMat = TextureFactory.getConcreteMaterial();
    const groundMat = TextureFactory.getGroundMaterial('mountain_dawn');
    const bunkerWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75, metalness: 0.25 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });

    // 1. Alpine Slate Ground (240x240m)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    PropKit.addCompoundRoads(scene, [
      { x: 0, z: 4, width: 7.0, length: 98, axis: 'z' },
      { x: -15, z: -2, width: 6.0, length: 24, axis: 'x' },
      { x: 14, z: -15, width: 6.0, length: 22, axis: 'x' },
    ]);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        colliders.push(new THREE.Box3().setFromObject(mesh));
      }
    };

    // 2. Fortress Bastion Perimeter Walls (140x140m)
    const wallH = 5.5;
    const wallT = 1.5;
    const compSize = 140;
    const half = compSize / 2;

    const northW = new THREE.Mesh(new THREE.BoxGeometry(compSize, wallH, wallT), bunkerWallMat);
    northW.position.set(0, wallH / 2, -half);
    scene.add(northW);
    addCollider(northW);

    const eastW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), bunkerWallMat);
    eastW.position.set(half, wallH / 2, 0);
    scene.add(eastW);
    addCollider(eastW);

    const westW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), bunkerWallMat);
    westW.position.set(-half, wallH / 2, 0);
    scene.add(westW);
    addCollider(westW);

    const gateGap = 16;
    const segW = (compSize - gateGap) / 2;
    const southL = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), bunkerWallMat);
    southL.position.set(-segW / 2 - gateGap / 2, wallH / 2, half);
    scene.add(southL);
    addCollider(southL);

    const southR = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), bunkerWallMat);
    southR.position.set(segW / 2 + gateGap / 2, wallH / 2, half);
    scene.add(southR);
    addCollider(southR);

    this.placeGuardCheckpoint(scene, colliders, new THREE.Vector3(gateGap / 2 + 4.2, 0, half - 4.2), bunkerWallMat);

    // 3. Central Missile Silo Blast Hatch & Subterranean Control Bunker
    const siloRing = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.2, 0.7, 24), concreteMat);
    siloRing.position.set(0, 0.35, 0);
    scene.add(siloRing);
    addCollider(siloRing);

    const siloCap = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 0.9, 20), steelMat);
    siloCap.position.set(0, 0.45, 0);
    scene.add(siloCap);

    // 4. Western Missile Launch Control Bunker (X: -30, Z: -2)
    const siloBunkerCols = this.createCommandBunker(scene, new THREE.Vector3(-30, 0, -2), 20, 22, 5.2, bunkerWallMat, 'east');
    siloBunkerCols.forEach((c) => colliders.push(c));

    const siloConsole = this.createConsoleTerminal(scene, new THREE.Vector3(-30, 0, -2), 0xef4444);
    colliders.push(siloConsole.box);
    interactiveItems.push({
      id: 'obj_silo_override',
      type: 'silo_override',
      position: new THREE.Vector3(-30, 0.8, -2),
      mesh: siloConsole.mesh,
    });

    // 5. Eastern Commander Fortress Bunker (X: 25, Z: -15)
    const cmdBunkerCols = this.createCommandBunker(scene, new THREE.Vector3(25, 0, -15), 22, 24, 5.8, bunkerWallMat, 'west');
    cmdBunkerCols.forEach((c) => colliders.push(c));

    // 6. Backup Diesel Dynamo Pillbox (X: 32, Z: 22)
    const dynamoCols = this.createCommandBunker(scene, new THREE.Vector3(32, 0, 22), 14, 14, 4.4, concreteMat, 'west');
    dynamoCols.forEach((c) => colliders.push(c));

    const dynamoConsole = this.createConsoleTerminal(scene, new THREE.Vector3(32, 0, 22), 0xeab308);
    colliders.push(dynamoConsole.box);
    interactiveItems.push({
      id: 'obj_bunker_breach',
      type: 'bunker_power',
      position: new THREE.Vector3(32, 0.8, 22),
      mesh: dynamoConsole.mesh,
    });

    // Lockers & Breaker Box
    const mtnOut: BuildingOutput = { colliders: [], interactiveItems: [], breakableProps: [], lights: [] };
    BuildingKit.addSupplyLocker(scene, mtnOut, new THREE.Vector3(-37, 0, 4), Math.PI / 2, 'locker_mtn_1');
    BuildingKit.addSupplyLocker(scene, mtnOut, new THREE.Vector3(33, 0, -22), -Math.PI / 2, 'locker_mtn_2');
    BuildingKit.addPowerBreakerBox(scene, mtnOut, new THREE.Vector3(-19.5, 1.35, 5), Math.PI / 2, 'breaker_mtn_1');
    this.mergeBuildingOutput(mtnOut, colliders, interactiveItems, breakableProps, compoundLights);

    PropKit.placeDecomposedArchitecturalModels(scene, colliders, [
      { key: 'military_outpost', pos: [-34, 0, -34], rotY: Math.PI / 4, width: 13 },
      { key: 'big_building', pos: [34, 0, -40], rotY: -Math.PI / 2, width: 16 },
    ]);

    PropKit.addFloodlightPoles(scene, colliders, compoundLights, [
      [-10, 0, 28],
      [10, 0, 28],
      [-10, 0, -24],
      [10, 0, -24],
    ]);

    this.placeMilitaryTrucks(scene, colliders, [
      { pos: [-16, 0, 28], rotY: Math.PI / 6 },
      { pos: [14, 0, 32], rotY: -Math.PI / 5 },
    ]);

    this.placeShippingContainers(scene, colliders, [
      { pos: [-14, 0, -24], color: 0x334155, rot: 0 },
      { pos: [14, 0, 6], color: 0x1e3a8a, rot: Math.PI / 2 },
    ]);

    // 7. Watchtowers with Ladders
    const tw1 = this.createWatchtower(scene, new THREE.Vector3(45, 0, 45), steelMat, 'ladder_se_3');
    tw1.colliders.forEach((c) => colliders.push(c));
    ladders.push(tw1.ladder);
    spotlights.push(tw1.spotlight);

    const tw2 = this.createWatchtower(scene, new THREE.Vector3(-45, 0, -45), steelMat, 'ladder_nw_3');
    tw2.colliders.forEach((c) => colliders.push(c));
    ladders.push(tw2.ladder);
    spotlights.push(tw2.spotlight);

    // 8. Mountain Helipad & UH-60A BlackHawk Extraction Helicopter (X: 0, Z: -50)
    const helipad = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.7 })
    );
    helipad.rotation.x = -Math.PI / 2;
    helipad.position.set(0, 0.06, -50);
    scene.add(helipad);

    const extractRing = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
    );
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.12, -50);
    scene.add(extractRing);
    interactiveItems.push({
      id: 'extraction_zone',
      type: 'extraction',
      position: new THREE.Vector3(0, 0.5, -50),
      mesh: extractRing,
    });

    const extractionHeli = this.createExtractionHelicopter(scene, new THREE.Vector3(0, 0.08, -56), -Math.PI / 8);

    // 9. Explosive Barrels & Pickups
    const mountainBarrels = [
      [-14, 0, 14],
      [14, 0, 14],
      [-18, 0, -14],
      [12, 0, -12],
      [22, 0, 20],
      [0, 0, -28],
    ];
    this.placeExplosiveBarrels(scene, colliders, explosiveBarrels, mountainBarrels, 'barrel_mtn');

    this.addStandardPickups(
      scene,
      interactiveItems,
      [
        [0, 0.25, 42],
        [-22, 0.25, 10],
        [20, 0.25, -4],
        [45, 9.2, 45],
        [-45, 9.2, -45],
      ],
      [
        [-12, 0.25, 25],
        [-26, 0.25, -8],
        [28, 0.25, -18],
      ]
    );

    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-19.5, 5, -2), 0, 'cam_mtn_1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(13.5, 5, -15), Math.PI, 'cam_mtn_2'));

    this.addEnvironmentVista(scene, colliders, 'mountain_dawn');
    PropKit.validateAndFixPlacements(colliders, interactiveItems, explosiveBarrels);

    return {
      colliders,
      interactiveItems,
      explosiveBarrels,
      breakableProps,
      compoundLights,
      powerCut: false,
      cameras,
      spotlights,
      ladders,
      extractionHeli,
      environmentType: 'mountain_dawn',
    };
  }

  // =========================================================================
  // MISSION 04: HARBOR NAVAL DOCKYARD (Operation Black Tide - Storm Cargo Pier)
  // =========================================================================
  private static buildHarborStormMap(scene: THREE.Scene): MapData {
    const colliders: THREE.Box3[] = [];
    const interactiveItems: InteractiveItem[] = [];
    const explosiveBarrels: ExplosiveBarrel[] = [];
    const breakableProps: BreakableProp[] = [];
    const compoundLights: THREE.Light[] = [];
    const cameras: SurveillanceCameraMesh[] = [];
    const ladders: LadderZone[] = [];
    const spotlights: { light: THREE.SpotLight; target: THREE.Object3D; baseAngle: number; sweepSpeed: number }[] = [];

    const helipadTex = TextureFactory.getHelipadTexture();
    const concreteMat = TextureFactory.getConcreteMaterial();
    const groundMat = TextureFactory.getGroundMaterial('night_depot');
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
    const portBrickMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75, metalness: 0.2 });

    // 1. Wet Concrete Dockyard Apron (240x240m) + Cargo Lanes
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    PropKit.addCompoundRoads(scene, [
      { x: 0, z: 4, width: 8.0, length: 104, axis: 'z' },
      { x: 0, z: -12, width: 7.0, length: 64, axis: 'x' },
      { x: 0, z: 22, width: 6.5, length: 56, axis: 'x' },
    ]);

    const addCollider = (mesh: THREE.Object3D | THREE.Box3) => {
      if (mesh instanceof THREE.Box3) {
        colliders.push(mesh);
      } else {
        mesh.updateMatrixWorld(true);
        colliders.push(new THREE.Box3().setFromObject(mesh));
      }
    };

    // 2. Naval Pier Perimeter Walls (144x144m)
    const wallH = 4.8;
    const wallT = 1.3;
    const compSize = 144;
    const half = compSize / 2;

    const northW = new THREE.Mesh(new THREE.BoxGeometry(compSize, wallH, wallT), concreteMat);
    northW.position.set(0, wallH / 2, -half);
    scene.add(northW);
    addCollider(northW);

    const eastW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    eastW.position.set(half, wallH / 2, 0);
    scene.add(eastW);
    addCollider(eastW);

    const westW = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, compSize), concreteMat);
    westW.position.set(-half, wallH / 2, 0);
    scene.add(westW);
    addCollider(westW);

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

    this.placeGuardCheckpoint(scene, colliders, new THREE.Vector3(gateGap / 2 + 4.2, 0, half - 4.2), concreteMat);

    // 3. Eastern Two-Story Port Authority / Harbourmaster Building (X: 32, Z: 0)
    const portAdminOut = BuildingKit.createTwoStoryAdminBuilding(
      scene,
      new THREE.Vector3(32, 0, 0),
      portBrickMat,
      concreteMat
    );
    this.mergeBuildingOutput(portAdminOut, colliders, interactiveItems, breakableProps, compoundLights);

    // Naval Cipher Briefcase inside Harbourmaster Office (X: 32, Z: 8)
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 1.4), steelMat);
    desk.position.set(32, 0.48, 8);
    scene.add(desk);
    addCollider(desk);

    const briefcase = this.createBriefcaseProp(scene, new THREE.Vector3(32, 1.05, 8));
    interactiveItems.push({
      id: 'briefcase',
      type: 'briefcase',
      position: briefcase.position.clone(),
      mesh: briefcase,
    });

    // Port Security Siren Terminal inside Harbourmaster Security Room (X: 28, Z: -14)
    const alarmTerminal = this.createConsoleTerminal(scene, new THREE.Vector3(28, 0, -14), 0xef4444);
    colliders.push(alarmTerminal.box);
    interactiveItems.push({
      id: 'alarm_console',
      type: 'alarm_console',
      position: new THREE.Vector3(28, 0.8, -14),
      mesh: alarmTerminal.mesh,
    });

    // 4. Western Armored Fuel Manifold Depot (X: -36, Z: -12 -> C4 target at X: -31.4, Z: -12)
    PropKit.addFuelDepotManifold(scene, colliders, interactiveItems, new THREE.Vector3(-36, 0, -12), true);
    PropKit.addFuelDepotManifold(scene, colliders, interactiveItems, new THREE.Vector3(-36, 0, -24), false);

    // 5. Cargo Container Labyrinth in Central Dockyard
    this.placeShippingContainers(scene, colliders, [
      { pos: [-12, 0, 26], color: 0x1e3a8a, rot: 0 },
      { pos: [12, 0, 26], color: 0xb91c1c, rot: 0 },
      { pos: [-10, 0, 8], color: 0x15803d, rot: Math.PI / 2 },
      { pos: [8, 0, 8], color: 0xca8a04, rot: Math.PI / 2 },
      { pos: [-12, 0, -22], color: 0x334155, rot: 0 },
      { pos: [12, 0, -26], color: 0x1e3a8a, rot: 0 },
    ]);

    this.placeMilitaryTrucks(scene, colliders, [
      { pos: [-18, 0, 34], rotY: Math.PI / 6 },
      { pos: [16, 0, -34], rotY: -Math.PI / 4 },
    ]);

    // 6. Watchtowers with Snipers & Ladders
    const tw1 = this.createWatchtower(scene, new THREE.Vector3(46, 0, 46), steelMat, 'ladder_se_4');
    tw1.colliders.forEach((c) => colliders.push(c));
    ladders.push(tw1.ladder);
    spotlights.push(tw1.spotlight);

    const tw2 = this.createWatchtower(scene, new THREE.Vector3(-46, 0, -46), steelMat, 'ladder_nw_4');
    tw2.colliders.forEach((c) => colliders.push(c));
    ladders.push(tw2.ladder);
    spotlights.push(tw2.spotlight);

    // 7. Pier Helipad & Extraction BlackHawk (X: 0, Z: -52)
    const helipad = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.7 })
    );
    helipad.rotation.x = -Math.PI / 2;
    helipad.position.set(0, 0.06, -52);
    scene.add(helipad);

    const extractRing = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
    );
    extractRing.rotation.x = -Math.PI / 2;
    extractRing.position.set(0, 0.12, -52);
    scene.add(extractRing);
    interactiveItems.push({
      id: 'extraction_zone',
      type: 'extraction',
      position: new THREE.Vector3(0, 0.5, -52),
      mesh: extractRing,
    });

    const extractionHeli = this.createExtractionHelicopter(scene, new THREE.Vector3(0, 0.08, -58), Math.PI / 10);

    // 8. Floodlights, Explosive Barrels, Pickups & Cameras
    PropKit.addFloodlightPoles(scene, colliders, compoundLights, [
      [-6, 0, 36],
      [6, 0, 16],
      [-6, 0, -10],
      [6, 0, -32],
    ]);

    this.placeExplosiveBarrels(
      scene,
      colliders,
      explosiveBarrels,
      [
        [-6, 0, 22],
        [6, 0, 14],
        [-22, 0, -8],
        [-22, 0, -16],
        [18, 0, -18],
      ],
      'barrel_dock'
    );

    this.addStandardPickups(
      scene,
      interactiveItems,
      [
        [0, 0.25, 42],
        [-18, 0.25, 12],
        [20, 0.25, 4],
        [46, 9.2, 46],
        [-46, 9.2, -46],
      ],
      [
        [-8, 0.25, 30],
        [-24, 0.25, -4],
        [35, 0.25, -6],
      ]
    );

    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(21.4, 5.2, 4), -Math.PI / 2, 'cam_dock_1'));
    cameras.push(this.createSurveillanceCamera(scene, new THREE.Vector3(-24, 5.0, -12), Math.PI / 4, 'cam_dock_2'));

    this.addEnvironmentVista(scene, colliders, 'harbor_storm');
    PropKit.validateAndFixPlacements(colliders, interactiveItems, explosiveBarrels);

    return {
      colliders,
      interactiveItems,
      explosiveBarrels,
      breakableProps,
      compoundLights,
      powerCut: false,
      cameras,
      spotlights,
      ladders,
      extractionHeli,
      environmentType: 'harbor_storm',
    };
  }

  // =========================================================================
  // SHARED 3D GLB ASSET PLACEMENT HELPERS
  // =========================================================================

  private static placeGuardCheckpoint(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    pos: THREE.Vector3,
    fallbackMat: THREE.Material
  ) {
    const guardTower = AssetLoader.cloneNormalizedModel('guard_tower', { targetHeight: 4.5 });
    if (guardTower) {
      guardTower.position.copy(pos);
      scene.add(guardTower);
      guardTower.updateMatrixWorld(true);
      colliders.push(new THREE.Box3().setFromObject(guardTower));
    } else {
      const shack = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.5, 4.5), fallbackMat);
      shack.position.set(pos.x, 1.75, pos.z);
      scene.add(shack);
      colliders.push(new THREE.Box3().setFromObject(shack));
    }
  }

  private static placeShippingContainers(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    placements: { pos: number[]; color: number; rot: number }[]
  ) {
    for (const c of placements) {
      const glbCont = AssetLoader.cloneNormalizedModel('shipping_container', { targetLength: 11.5 });
      if (glbCont) {
        glbCont.position.set(c.pos[0], c.pos[1], c.pos[2]);
        glbCont.rotation.y = c.rot;
        scene.add(glbCont);
        glbCont.updateMatrixWorld(true);
        colliders.push(new THREE.Box3().setFromObject(glbCont));
      } else {
        const cont = new THREE.Mesh(
          new THREE.BoxGeometry(12, 2.8, 3.2),
          new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.6, metalness: 0.4 })
        );
        cont.position.set(c.pos[0], c.pos[1] + 1.4, c.pos[2]);
        cont.rotation.y = c.rot;
        cont.castShadow = true;
        scene.add(cont);
        colliders.push(new THREE.Box3().setFromObject(cont));
      }
    }
  }

  private static placeMilitaryTrucks(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    placements: { pos: [number, number, number]; rotY: number }[]
  ) {
    for (const t of placements) {
      const truck = AssetLoader.cloneNormalizedModel('military_truck', { targetLength: 7.8 });
      if (truck) {
        truck.position.set(t.pos[0], t.pos[1], t.pos[2]);
        truck.rotation.y = t.rotY;
        scene.add(truck);
        truck.updateMatrixWorld(true);
        colliders.push(new THREE.Box3().setFromObject(truck));
      }
    }
  }

  private static createExtractionHelicopter(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    rotY: number
  ): ExtractionHelicopter {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const heliModel = AssetLoader.cloneNormalizedModel('blackhawk_heli', { targetLength: 15.2 });
    if (heliModel) {
      group.add(heliModel);
    } else {
      const fuselage = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 2.6, 12),
        new THREE.MeshStandardMaterial({ color: 0x273027, roughness: 0.5, metalness: 0.6 })
      );
      fuselage.position.y = 1.6;
      group.add(fuselage);
    }

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 3.85, 0.4);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.4, metalness: 0.8 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 12), bladeMat);
    rotorGroup.add(hub);

    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.04, 0.32), bladeMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 11.5), bladeMat);
    rotorGroup.add(blade1, blade2);
    group.add(rotorGroup);

    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.35, 3.2, -6.2);
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.18), bladeMat);
    tailRotor.add(tBlade);
    group.add(tailRotor);

    scene.add(group);
    return {
      group,
      rotor: rotorGroup,
      tailRotor,
      basePos: pos.clone(),
    };
  }

  private static placeSupplyCrates(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    placements: { pos: number[]; size: number[] }[]
  ) {
    const crateTex = TextureFactory.getCrateTexture();
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.7, metalness: 0.1 });

    placements.forEach((c, idx) => {
      const useCardboard = idx % 4 === 3;
      const glbProp = useCardboard
        ? AssetLoader.cloneNormalizedModel('cardboard_boxes', { targetWidth: c.size[0] })
        : AssetLoader.cloneNormalizedModel('military_crates', {
            meshNameFilter: 'Single_Crate',
            targetWidth: c.size[0],
          });

      if (glbProp) {
        glbProp.position.set(c.pos[0], c.pos[1], c.pos[2]);
        scene.add(glbProp);
      } else {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.size[0], c.size[1], c.size[2]), crateMat);
        mesh.position.set(c.pos[0], c.pos[1] + c.size[1] / 2, c.pos[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }

      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(c.pos[0] - c.size[0] / 2, c.pos[1], c.pos[2] - c.size[2] / 2),
          new THREE.Vector3(c.pos[0] + c.size[0] / 2, c.pos[1] + c.size[1], c.pos[2] + c.size[2] / 2)
        )
      );
    });
  }

  private static placeExplosiveBarrels(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    explosiveBarrels: ExplosiveBarrel[],
    positions: number[][],
    prefix: string
  ) {
    const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.7 });
    const hazardRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    positions.forEach((pos, idx) => {
      const glbBarrel = AssetLoader.cloneNormalizedModel('barrels', { targetHeight: 1.3 });
      let barrelObj: THREE.Object3D;

      if (glbBarrel) {
        const wrapper = new THREE.Group();
        wrapper.position.set(pos[0], pos[1], pos[2]);
        wrapper.add(glbBarrel);

        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 16), hazardRingMat);
        ring.position.y = 0.72;
        wrapper.add(ring);

        scene.add(wrapper);
        barrelObj = wrapper;
      } else {
        const mesh = new THREE.Mesh(barrelGeo, barrelMat);
        mesh.position.set(pos[0], pos[1] + 0.65, pos[2]);
        mesh.castShadow = true;
        scene.add(mesh);
        barrelObj = mesh;
      }

      const bBox = new THREE.Box3(
        new THREE.Vector3(pos[0] - 0.48, pos[1], pos[2] - 0.48),
        new THREE.Vector3(pos[0] + 0.48, pos[1] + 1.35, pos[2] + 0.48)
      );
      colliders.push(bBox);

      explosiveBarrels.push({
        id: `${prefix}_${idx}`,
        mesh: barrelObj,
        position: new THREE.Vector3(pos[0], pos[1] + 0.65, pos[2]),
        health: 30,
        isExploded: false,
      });
    });
  }

  private static createBriefcaseProp(scene: THREE.Scene, pos: THREE.Vector3): THREE.Object3D {
    const group = new THREE.Group();
    group.position.copy(pos);

    const caseBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.18, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.85 })
    );
    group.add(caseBody);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.9, roughness: 0.2 })
    );
    handle.position.set(0, 0.08, 0.25);
    group.add(handle);

    const beaconLight = new THREE.PointLight(0xf59e0b, 1.2, 4);
    beaconLight.position.set(0, 0.35, 0);
    group.add(beaconLight);

    scene.add(group);
    return group;
  }

  private static addEnvironmentVista(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    env: EnvironmentType
  ) {
    // 1. Distant Horizon Mountains (Capped at 2 opposite horizon ranges for 50% lower vertex cost)
    const mountainCoords: [number, number, number, number][] = [
      [0, -2, -170, 0],
      [0, -2, 170, Math.PI],
    ];
    for (const [mx, my, mz, mRot] of mountainCoords) {
      const mtn = AssetLoader.cloneNormalizedModel('background_mountains', {
        targetWidth: 190,
        castShadow: false,
        receiveShadow: false,
      });
      if (mtn) {
        mtn.position.set(mx, my, mz);
        mtn.rotation.y = mRot;
        scene.add(mtn);
      }
    }

    // 2. Tactical Boulder Rocks inside & outside compound
    const rockCoords: [number, number, number, number][] = [
      [-26, 0, 38, 2.0],
      [28, 0, 36, 2.2],
      [-52, 0, 18, 2.5],
      [52, 0, -24, 2.3],
      [-8, 0, -40, 1.8],
      [22, 0, -42, 2.1],
    ];
    for (const [rx, ry, rz, rHeight] of rockCoords) {
      const rock = AssetLoader.cloneNormalizedModel('rocks', {
        meshNameFilter: 'SM_rock02',
        targetHeight: rHeight,
        castShadow: false,
      });
      if (rock) {
        rock.position.set(rx, ry, rz);
        rock.rotation.y = (rx + rz) * 0.5;
        scene.add(rock);
        colliders.push(
          new THREE.Box3(
            new THREE.Vector3(rx - 1.1, 0, rz - 1.1),
            new THREE.Vector3(rx + 1.1, rHeight * 0.85, rz + 1.1)
          )
        );
      }
    }

    // 3. Pine Trees & Dead Trees along perimeter
    const treeCoords: [number, number, number][] = [
      [-58, 0, 56],
      [58, 0, 56],
      [-58, 0, -20],
      [58, 0, 22],
      [-60, 0, 35],
      [60, 0, -35],
    ];
    treeCoords.forEach(([tx, ty, tz], idx) => {
      const useDeadTree = env === 'daylight_radar' || idx % 4 === 0;
      const tree = useDeadTree
        ? AssetLoader.cloneNormalizedModel('dead_trees', {
            meshNameFilter: 'SM_dead-tree04',
            targetHeight: 6.8,
            castShadow: false,
          })
        : AssetLoader.cloneNormalizedModel('pine_trees', {
            meshNameFilter: 'SM_pine01',
            targetHeight: 9.5,
            castShadow: false,
          });
      if (tree) {
        tree.position.set(tx, ty, tz);
        tree.rotation.y = idx * 1.1;
        scene.add(tree);
        colliders.push(
          new THREE.Box3(
            new THREE.Vector3(tx - 0.45, 0, tz - 0.45),
            new THREE.Vector3(tx + 0.45, 4.5, tz + 0.45)
          )
        );
      }
    });
  }

  private static createWatchtower(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    metalMat: THREE.Material,
    ladderId: string
  ) {
    const colliders: THREE.Box3[] = [];
    const towerGroup = new THREE.Group();
    towerGroup.position.copy(pos);

    const legH = 9;
    const legSpacing = 2.4;

    const glbTower = AssetLoader.cloneNormalizedModel('watch_tower', { targetHeight: 11.8 });
    if (glbTower) {
      towerGroup.add(glbTower);
    } else {
      const legGeo = new THREE.BoxGeometry(0.35, legH, 0.35);
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
    }

    const ladderGroup = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.8 });
    const railGeo = new THREE.BoxGeometry(0.08, legH + 0.4, 0.08);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-0.35, legH / 2, 2.75);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(0.35, legH / 2, 2.75);
    ladderGroup.add(leftRail, rightRail);

    const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
    for (let y = 0.5; y <= legH; y += 0.55) {
      const rung = new THREE.Mesh(rungGeo, railMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, y, 2.75);
      ladderGroup.add(rung);
    }
    towerGroup.add(ladderGroup);

    scene.add(towerGroup);

    [
      [-legSpacing, -legSpacing],
      [legSpacing, -legSpacing],
      [-legSpacing, legSpacing],
      [legSpacing, legSpacing],
    ].forEach(([lx, lz]) => {
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(pos.x + lx - 0.35, pos.y, pos.z + lz - 0.35),
          new THREE.Vector3(pos.x + lx + 0.35, pos.y + legH, pos.z + lz + 0.35)
        )
      );
    });

    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(pos.x - 2.8, pos.y + legH - 0.3, pos.z - 2.8),
        new THREE.Vector3(pos.x + 2.8, pos.y + legH + 0.1, pos.z + 2.5)
      )
    );

    const ladder: LadderZone = {
      id: ladderId,
      box: new THREE.Box3(
        new THREE.Vector3(pos.x - 0.9, pos.y, pos.z + 2.1),
        new THREE.Vector3(pos.x + 0.9, pos.y + legH + 1.2, pos.z + 3.4)
      ),
      topY: pos.y + legH + 0.2,
    };

    const spotlight = new THREE.SpotLight(0xfff7ed, 3.5, 55, Math.PI / 6, 0.4, 1.2);
    spotlight.position.set(pos.x, pos.y + legH + 1, pos.z);
    spotlight.castShadow = false;
    scene.add(spotlight);

    const targetObj = new THREE.Object3D();
    targetObj.position.set(pos.x + 20, 0, pos.z + 20);
    scene.add(targetObj);
    spotlight.target = targetObj;

    return {
      colliders,
      ladder,
      spotlight: {
        light: spotlight,
        target: targetObj,
        baseAngle: Math.random() * Math.PI * 2,
        sweepSpeed: 0.4,
      },
    };
  }

  private static createRadarControlComplex(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    wallMat: THREE.Material,
    metalMat: THREE.Material
  ): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 32;
    const l = 26;
    const h = 6;

    const east = new THREE.Mesh(new THREE.BoxGeometry(1, h, l), wallMat);
    east.position.set(pos.x + w / 2, h / 2, pos.z);
    scene.add(east);
    colliders.push(new THREE.Box3().setFromObject(east));

    const north = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), wallMat);
    north.position.set(pos.x, h / 2, pos.z - l / 2);
    scene.add(north);
    colliders.push(new THREE.Box3().setFromObject(north));

    const south = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), wallMat);
    south.position.set(pos.x, h / 2, pos.z + l / 2);
    scene.add(south);
    colliders.push(new THREE.Box3().setFromObject(south));

    const segL = (l - 8) / 2;
    const west1 = new THREE.Mesh(new THREE.BoxGeometry(1, h, segL), wallMat);
    west1.position.set(pos.x - w / 2, h / 2, pos.z - l / 2 + segL / 2);
    scene.add(west1);
    colliders.push(new THREE.Box3().setFromObject(west1));

    const west2 = new THREE.Mesh(new THREE.BoxGeometry(1, h, segL), wallMat);
    west2.position.set(pos.x - w / 2, h / 2, pos.z + l / 2 - segL / 2);
    scene.add(west2);
    colliders.push(new THREE.Box3().setFromObject(west2));

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, l + 1), metalMat);
    roof.position.set(pos.x, h + 0.25, pos.z);
    scene.add(roof);
    colliders.push(new THREE.Box3().setFromObject(roof));

    return colliders;
  }

  private static createParabolicDish(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    radius: number,
    mat: THREE.Material
  ): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 2.5, 12), mat);
    base.position.set(pos.x, pos.y + 1.25, pos.z);
    scene.add(base);
    colliders.push(new THREE.Box3().setFromObject(base));

    const dish = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 0.45, 20, 1, true), mat);
    dish.position.set(pos.x, pos.y + 3.5, pos.z);
    dish.rotation.x = Math.PI * 0.72;
    scene.add(dish);
    return colliders;
  }

  private static createGeneratorStation(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    wallMat: THREE.Material,
    metalMat: THREE.Material
  ): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const w = 22;
    const l = 20;
    const h = 3.6;

    const west = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, l), wallMat);
    west.position.set(pos.x - w / 2, h / 2, pos.z);
    scene.add(west);
    colliders.push(new THREE.Box3().setFromObject(west));

    const north = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), wallMat);
    north.position.set(pos.x, h / 2, pos.z - l / 2);
    scene.add(north);
    colliders.push(new THREE.Box3().setFromObject(north));

    const south = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), wallMat);
    south.position.set(pos.x, h / 2, pos.z + l / 2);
    scene.add(south);
    colliders.push(new THREE.Box3().setFromObject(south));

    for (const offsetZ of [-5, 5]) {
      const turbine = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 14), metalMat);
      turbine.rotation.z = Math.PI / 2;
      turbine.position.set(pos.x - 4, 1.5, pos.z + offsetZ);
      scene.add(turbine);
      colliders.push(new THREE.Box3().setFromObject(turbine));
    }

    return colliders;
  }

  private static createCommandBunker(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    w: number,
    l: number,
    h: number,
    wallMat: THREE.Material,
    doorSide: 'east' | 'west'
  ): THREE.Box3[] {
    const colliders: THREE.Box3[] = [];
    const wallT = 1.2;
    const doorGap = 5.5;

    const north = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), wallMat);
    north.position.set(pos.x, h / 2, pos.z - l / 2);
    scene.add(north);
    colliders.push(new THREE.Box3().setFromObject(north));

    const south = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), wallMat);
    south.position.set(pos.x, h / 2, pos.z + l / 2);
    scene.add(south);
    colliders.push(new THREE.Box3().setFromObject(south));

    if (doorSide === 'east') {
      const west = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, l), wallMat);
      west.position.set(pos.x - w / 2, h / 2, pos.z);
      scene.add(west);
      colliders.push(new THREE.Box3().setFromObject(west));

      const segL = (l - doorGap) / 2;
      const east1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, segL), wallMat);
      east1.position.set(pos.x + w / 2, h / 2, pos.z - l / 2 + segL / 2);
      scene.add(east1);
      colliders.push(new THREE.Box3().setFromObject(east1));

      const east2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, segL), wallMat);
      east2.position.set(pos.x + w / 2, h / 2, pos.z + l / 2 - segL / 2);
      scene.add(east2);
      colliders.push(new THREE.Box3().setFromObject(east2));
    } else {
      const east = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, l), wallMat);
      east.position.set(pos.x + w / 2, h / 2, pos.z);
      scene.add(east);
      colliders.push(new THREE.Box3().setFromObject(east));

      const segL = (l - doorGap) / 2;
      const west1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, segL), wallMat);
      west1.position.set(pos.x - w / 2, h / 2, pos.z - l / 2 + segL / 2);
      scene.add(west1);
      colliders.push(new THREE.Box3().setFromObject(west1));

      const west2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, segL), wallMat);
      west2.position.set(pos.x - w / 2, h / 2, pos.z + l / 2 - segL / 2);
      scene.add(west2);
      colliders.push(new THREE.Box3().setFromObject(west2));
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.6, l + 1), wallMat);
    roof.position.set(pos.x, h + 0.3, pos.z);
    scene.add(roof);
    colliders.push(new THREE.Box3().setFromObject(roof));

    return colliders;
  }

  private static createConsoleTerminal(scene: THREE.Scene, pos: THREE.Vector3, screenColor: number) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.3, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 })
    );
    base.position.y = 0.65;
    group.add(base);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.1),
      new THREE.MeshBasicMaterial({ color: screenColor })
    );
    screen.position.set(0, 1.45, 0);
    group.add(screen);

    const pLight = new THREE.PointLight(screenColor, 1.4, 5);
    pLight.position.set(0, 1.6, 0.4);
    group.add(pLight);

    scene.add(group);
    const box = new THREE.Box3().setFromObject(base);
    box.min.add(pos);
    box.max.add(pos);
    return { mesh: group, box };
  }

  private static createSurveillanceCamera(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    baseAngle: number,
    id: string
  ): SurveillanceCameraMesh {
    const mount = new THREE.Group();
    mount.position.copy(pos);
    scene.add(mount);

    const head = new THREE.Group();
    head.rotation.y = baseAngle;
    mount.add(head);

    const camBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.25, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 })
    );
    head.add(camBody);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.3);
    head.add(lens);

    const coneGeo = new THREE.ConeGeometry(3.2, 14, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lightCone = new THREE.Mesh(coneGeo, coneMat);
    lightCone.rotation.x = -Math.PI / 2;
    lightCone.position.set(0, -1.2, 7);
    head.add(lightCone);

    const light = new THREE.SpotLight(0xef4444, 2, 20, Math.PI / 7, 0.5, 1);
    light.position.set(0, 0, 0.3);
    head.add(light);

    return {
      id,
      mount,
      head,
      lightCone,
      light,
      baseAngle,
      sweepRange: Math.PI / 2.2,
      isDestroyed: false,
    };
  }

  private static addStandardPickups(
    scene: THREE.Scene,
    interactiveItems: InteractiveItem[],
    ammoCoords: [number, number, number][],
    medkitCoords: [number, number, number][]
  ) {
    const ammoMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, metalness: 0.4 });
    ammoCoords.forEach(([ax, ay, az], idx) => {
      const glbAmmo = AssetLoader.cloneNormalizedModel('military_crates', {
        meshNameFilter: 'Crate_Sup',
        targetWidth: 0.72,
        castShadow: false,
      });

      let mesh: THREE.Object3D;
      if (glbAmmo) {
        glbAmmo.position.set(ax, ay - 0.2, az);
        scene.add(glbAmmo);
        mesh = glbAmmo;
      } else {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.45), ammoMat);
        box.position.set(ax, ay, az);
        scene.add(box);
        mesh = box;
      }

      interactiveItems.push({
        id: `ammo_${idx}`,
        type: 'ammo',
        position: new THREE.Vector3(ax, ay, az),
        mesh,
      });
    });

    const medMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    medkitCoords.forEach(([mx, my, mz], idx) => {
      const glbMed = AssetLoader.cloneNormalizedModel('first_aid_box', {
        targetWidth: 0.58,
        castShadow: false,
      });

      let mesh: THREE.Object3D;
      if (glbMed) {
        glbMed.position.set(mx, my - 0.2, mz);
        scene.add(glbMed);
        mesh = glbMed;
      } else {
        const group = new THREE.Group();
        group.position.set(mx, my, mz);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.42), medMat);
        group.add(box);
        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.09), crossMat);
        cross1.position.y = 0.15;
        const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.28), crossMat);
        cross2.position.y = 0.15;
        group.add(cross1, cross2);
        scene.add(group);
        mesh = group;
      }

      interactiveItems.push({
        id: `medkit_${idx}`,
        type: 'medkit',
        position: new THREE.Vector3(mx, my, mz),
        mesh,
      });
    });
  }
}
