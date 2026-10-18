import * as THREE from 'three';
import { TextureFactory } from '../TextureFactory';
import type { BreakableProp, InteractiveItem } from '../MapBuilder';

export interface BuildingOutput {
  colliders: THREE.Box3[];
  interactiveItems: InteractiveItem[];
  breakableProps: BreakableProp[];
  lights: THREE.Light[];
}

export class BuildingKit {
  /**
   * Builds a wall along either the X axis (length along X, thickness along Z)
   * or the Z axis (length along Z, thickness along X) with a centered door opening
   * and an optional interactive hinged door.
   */
  public static addWallWithDoor(
    scene: THREE.Scene,
    out: BuildingOutput,
    opts: {
      center: THREE.Vector3;
      length: number;
      height: number;
      thickness: number;
      axis: 'x' | 'z';
      doorOffset?: number;
      doorWidth?: number;
      doorHeight?: number;
      wallMat: THREE.Material;
      trimMat: THREE.Material;
      doorId?: string;
      addInteractiveDoor?: boolean;
      isLocked?: boolean;
    }
  ) {
    const doorW = opts.doorWidth ?? 2.4;
    const doorH = opts.doorHeight ?? 2.6;
    const doorOff = opts.doorOffset ?? 0;
    const halfL = opts.length / 2;
    const dMin = doorOff - doorW / 2;
    const dMax = doorOff + doorW / 2;

    const leftLen = Math.max(0.2, dMin - -halfL);
    const rightLen = Math.max(0.2, halfL - dMax);
    const lintelH = Math.max(0.2, opts.height - doorH);

    const makeSeg = (segLen: number, segH: number, localAlong: number, localY: number) => {
      const geo =
        opts.axis === 'x'
          ? new THREE.BoxGeometry(segLen, segH, opts.thickness)
          : new THREE.BoxGeometry(opts.thickness, segH, segLen);
      const mesh = new THREE.Mesh(geo, opts.wallMat);
      if (opts.axis === 'x') {
        mesh.position.set(opts.center.x + localAlong, opts.center.y + localY, opts.center.z);
      } else {
        mesh.position.set(opts.center.x, opts.center.y + localY, opts.center.z + localAlong);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mesh.updateMatrixWorld(true);
      out.colliders.push(new THREE.Box3().setFromObject(mesh));
    };

    // Left pier, Right pier, Top lintel
    makeSeg(leftLen, opts.height, -halfL + leftLen / 2, opts.height / 2);
    makeSeg(rightLen, opts.height, halfL - rightLen / 2, opts.height / 2);
    makeSeg(doorW, lintelH, doorOff, doorH + lintelH / 2);

    // Door frame posts
    const postGeo = new THREE.BoxGeometry(0.14, doorH, opts.thickness + 0.08);
    [-doorW / 2, doorW / 2].forEach((side) => {
      const post = new THREE.Mesh(postGeo, opts.trimMat);
      if (opts.axis === 'x') {
        post.position.set(opts.center.x + doorOff + side, opts.center.y + doorH / 2, opts.center.z);
      } else {
        post.rotation.y = Math.PI / 2;
        post.position.set(opts.center.x, opts.center.y + doorH / 2, opts.center.z + doorOff + side);
      }
      scene.add(post);
    });

    // Optional interactive hinged steel security door
    if (opts.addInteractiveDoor && opts.doorId) {
      const hingeGroup = new THREE.Group();
      const hingeOffset = -doorW / 2 + 0.06;
      if (opts.axis === 'x') {
        hingeGroup.position.set(opts.center.x + doorOff + hingeOffset, opts.center.y, opts.center.z);
      } else {
        hingeGroup.position.set(opts.center.x, opts.center.y, opts.center.z + doorOff + hingeOffset);
        hingeGroup.rotation.y = -Math.PI / 2;
      }

      const doorMat = new THREE.MeshStandardMaterial({
        color: opts.isLocked ? 0x7f1d1d : 0x334155,
        roughness: 0.45,
        metalness: 0.75,
      });
      const leafW = doorW - 0.14;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, doorH - 0.08, 0.12), doorMat);
      leaf.position.set(leafW / 2, doorH / 2, 0);
      leaf.castShadow = true;
      hingeGroup.add(leaf);

      // Door handle & viewport slit
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.24), handleMat);
      handle.position.set(leafW - 0.22, 1.05, 0);
      hingeGroup.add(handle);

      const baseRotY = hingeGroup.rotation.y;
      scene.add(hingeGroup);
      hingeGroup.updateMatrixWorld(true);

      const doorCollider = new THREE.Box3().setFromObject(hingeGroup);
      out.colliders.push(doorCollider);

      const doorWorldPos =
        opts.axis === 'x'
          ? new THREE.Vector3(opts.center.x + doorOff, opts.center.y + 1.2, opts.center.z)
          : new THREE.Vector3(opts.center.x, opts.center.y + 1.2, opts.center.z + doorOff);

      out.interactiveItems.push({
        id: opts.doorId,
        type: 'door',
        position: doorWorldPos,
        mesh: hingeGroup,
        hingeGroup,
        baseRotY,
        isOpen: false,
        isLocked: opts.isLocked ?? false,
        colliderBox: doorCollider,
        label: opts.isLocked ? 'SECURITY DOOR (KEYCARD REQUIRED)' : 'TACTICAL DOOR',
      });
    }
  }

  /**
   * Builds a wall with breakable glass window openings so players and guards have
   * realistic sightlines and players can shoot out the glass or vault/fire through.
   */
  public static addWallWithWindows(
    scene: THREE.Scene,
    out: BuildingOutput,
    opts: {
      center: THREE.Vector3;
      length: number;
      height: number;
      thickness: number;
      axis: 'x' | 'z';
      windowCount: number;
      sillHeight?: number;
      windowHeight?: number;
      wallMat: THREE.Material;
      trimMat: THREE.Material;
      idPrefix: string;
    }
  ) {
    const sillH = opts.sillHeight ?? 1.15;
    const winH = opts.windowHeight ?? 1.45;
    const headerH = Math.max(0.25, opts.height - sillH - winH);

    const makeSpan = (segLen: number, segH: number, localAlong: number, localY: number) => {
      const geo =
        opts.axis === 'x'
          ? new THREE.BoxGeometry(segLen, segH, opts.thickness)
          : new THREE.BoxGeometry(opts.thickness, segH, segLen);
      const mesh = new THREE.Mesh(geo, opts.wallMat);
      if (opts.axis === 'x') {
        mesh.position.set(opts.center.x + localAlong, opts.center.y + localY, opts.center.z);
      } else {
        mesh.position.set(opts.center.x, opts.center.y + localY, opts.center.z + localAlong);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mesh.updateMatrixWorld(true);
      out.colliders.push(new THREE.Box3().setFromObject(mesh));
    };

    // Full-length bottom sill wall and top header beam
    makeSpan(opts.length, sillH, 0, sillH / 2);
    makeSpan(opts.length, headerH, 0, sillH + winH + headerH / 2);

    // Piers and breakable window panes
    const bayLen = opts.length / opts.windowCount;
    const winW = Math.min(2.6, bayLen * 0.56);
    const pierW = (bayLen - winW) / 2;

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.34,
      roughness: 0.1,
      metalness: 0.8,
    });

    for (let i = 0; i < opts.windowCount; i++) {
      const bayCenter = -opts.length / 2 + bayLen * (i + 0.5);
      // Left and right piers of this bay
      makeSpan(pierW, winH, bayCenter - winW / 2 - pierW / 2, sillH + winH / 2);
      makeSpan(pierW, winH, bayCenter + winW / 2 + pierW / 2, sillH + winH / 2);

      // Breakable glass pane
      const paneGeo =
        opts.axis === 'x'
          ? new THREE.BoxGeometry(winW, winH, 0.06)
          : new THREE.BoxGeometry(0.06, winH, winW);
      const pane = new THREE.Mesh(paneGeo, glassMat.clone());
      const paneY = opts.center.y + sillH + winH / 2;
      if (opts.axis === 'x') {
        pane.position.set(opts.center.x + bayCenter, paneY, opts.center.z);
      } else {
        pane.position.set(opts.center.x, paneY, opts.center.z + bayCenter);
      }
      scene.add(pane);
      pane.updateMatrixWorld(true);
      const paneBox = new THREE.Box3().setFromObject(pane);

      out.breakableProps.push({
        id: `${opts.idPrefix}_win_${i}`,
        kind: 'window',
        mesh: pane,
        position: pane.position.clone(),
        box: paneBox,
        health: 15,
        isBroken: false,
      });
    }
  }

  /**
   * Creates a walk-up staircase with individual step colliders so the player's
   * existing 0.6m step-up physics climbs cleanly between floors.
   */
  public static addStaircase(
    scene: THREE.Scene,
    out: BuildingOutput,
    opts: {
      start: THREE.Vector3;
      end: THREE.Vector3;
      width: number;
      steps: number;
      mat: THREE.Material;
    }
  ) {
    const totalDX = opts.end.x - opts.start.x;
    const totalDY = opts.end.y - opts.start.y;
    const totalDZ = opts.end.z - opts.start.z;
    const stepH = totalDY / opts.steps;
    const horizLen = Math.hypot(totalDX, totalDZ);
    const stepDepth = horizLen / opts.steps;
    const alongX = Math.abs(totalDX) > Math.abs(totalDZ);

    for (let i = 0; i < opts.steps; i++) {
      const t = (i + 0.5) / opts.steps;
      const sx = opts.start.x + totalDX * t;
      const sy = opts.start.y + stepH * (i + 1);
      const sz = opts.start.z + totalDZ * t;

      const geo = alongX
        ? new THREE.BoxGeometry(stepDepth + 0.08, stepH, opts.width)
        : new THREE.BoxGeometry(opts.width, stepH, stepDepth + 0.08);
      const stepMesh = new THREE.Mesh(geo, opts.mat);
      stepMesh.position.set(sx, sy - stepH / 2, sz);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      scene.add(stepMesh);
      stepMesh.updateMatrixWorld(true);
      out.colliders.push(new THREE.Box3().setFromObject(stepMesh));
    }
  }

  /**
   * Builds a two-story Cold War Administration & Security Building (20m x 24m x 8.4m)
   * with interactive doors, breakable windows, interior security room, lockers,
   * staircase to 2nd floor overwatch, and exterior power breaker box.
   */
  public static createTwoStoryAdminBuilding(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    wallMat: THREE.Material,
    concreteMat: THREE.Material
  ): BuildingOutput {
    const out: BuildingOutput = {
      colliders: [],
      interactiveItems: [],
      breakableProps: [],
      lights: [],
    };

    const w = 20;
    const l = 24;
    const floor1H = 4.2;
    const floor2H = 4.0;
    const totalH = floor1H + floor2H;
    const wallT = 0.8;

    const trimMat = TextureFactory.getMetalTrimMaterial();
    const floorMat = TextureFactory.getWalkwayMaterial(4, 4);

    // Ground floor raised foundation slab
    const slab1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, l), floorMat);
    slab1.position.set(pos.x, 0.08, pos.z);
    slab1.receiveShadow = true;
    scene.add(slab1);

    // 1. Ground Floor Walls
    // West facade: Main entrance door + windows
    this.addWallWithDoor(scene, out, {
      center: new THREE.Vector3(pos.x - w / 2, 0, pos.z),
      length: l,
      height: floor1H,
      thickness: wallT,
      axis: 'z',
      doorOffset: 3,
      doorWidth: 2.6,
      doorHeight: 2.7,
      wallMat,
      trimMat,
      doorId: 'door_admin_main',
      addInteractiveDoor: true,
    });

    // South facade: Windows
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x, 0, pos.z + l / 2),
      length: w,
      height: floor1H,
      thickness: wallT,
      axis: 'x',
      windowCount: 3,
      wallMat,
      trimMat,
      idPrefix: 'admin_s1',
    });

    // North facade: Rear tactical entry door
    this.addWallWithDoor(scene, out, {
      center: new THREE.Vector3(pos.x, 0, pos.z - l / 2),
      length: w,
      height: floor1H,
      thickness: wallT,
      axis: 'x',
      doorOffset: -3,
      doorWidth: 2.4,
      doorHeight: 2.6,
      wallMat,
      trimMat,
      doorId: 'door_admin_north',
      addInteractiveDoor: true,
    });

    // East wall: Solid reinforced wall with windows
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x + w / 2, 0, pos.z),
      length: l,
      height: floor1H,
      thickness: wallT,
      axis: 'z',
      windowCount: 3,
      wallMat,
      trimMat,
      idPrefix: 'admin_e1',
    });

    // Interior partition dividing Lobby (South) from Security Control Room (North)
    this.addWallWithDoor(scene, out, {
      center: new THREE.Vector3(pos.x + 1.5, 0, pos.z),
      length: w - 3.5,
      height: floor1H,
      thickness: 0.45,
      axis: 'x',
      doorOffset: -2.0,
      doorWidth: 2.4,
      doorHeight: 2.6,
      wallMat: concreteMat,
      trimMat,
      doorId: 'door_admin_security',
      addInteractiveDoor: true,
    });

    // 2. Interior Staircase along West-South wall up to 2nd Floor (y = 0 -> 4.2m)
    this.addStaircase(scene, out, {
      start: new THREE.Vector3(pos.x - w / 2 + 2.2, 0, pos.z + l / 2 - 2.2),
      end: new THREE.Vector3(pos.x - w / 2 + 2.2, floor1H, pos.z + 1.8),
      width: 2.2,
      steps: 10,
      mat: trimMat,
    });

    // 3. Second Floor Deck (leaving stairwell cutout on West-South side)
    const deckMain = new THREE.Mesh(new THREE.BoxGeometry(w - 4.2, 0.35, l - 0.8), concreteMat);
    deckMain.position.set(pos.x + 2.1, floor1H - 0.15, pos.z);
    deckMain.castShadow = true;
    deckMain.receiveShadow = true;
    scene.add(deckMain);
    deckMain.updateMatrixWorld(true);
    out.colliders.push(new THREE.Box3().setFromObject(deckMain));

    const deckNorth = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, l / 2 - 1.5), concreteMat);
    deckNorth.position.set(pos.x - w / 2 + 2.1, floor1H - 0.15, pos.z - l / 4 - 0.5);
    scene.add(deckNorth);
    deckNorth.updateMatrixWorld(true);
    out.colliders.push(new THREE.Box3().setFromObject(deckNorth));

    // 4. Second Floor Overwatch Walls with Windows
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x - w / 2, floor1H, pos.z),
      length: l,
      height: floor2H,
      thickness: wallT,
      axis: 'z',
      windowCount: 4,
      wallMat,
      trimMat,
      idPrefix: 'admin_w2',
    });
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x + w / 2, floor1H, pos.z),
      length: l,
      height: floor2H,
      thickness: wallT,
      axis: 'z',
      windowCount: 3,
      wallMat,
      trimMat,
      idPrefix: 'admin_e2',
    });
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x, floor1H, pos.z - l / 2),
      length: w,
      height: floor2H,
      thickness: wallT,
      axis: 'x',
      windowCount: 3,
      wallMat,
      trimMat,
      idPrefix: 'admin_n2',
    });
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x, floor1H, pos.z + l / 2),
      length: w,
      height: floor2H,
      thickness: wallT,
      axis: 'x',
      windowCount: 3,
      wallMat,
      trimMat,
      idPrefix: 'admin_s2',
    });

    // 5. Roof Slab & Parapet Trim
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.45, l + 1.2), concreteMat);
    roof.position.set(pos.x, totalH + 0.2, pos.z);
    roof.castShadow = true;
    scene.add(roof);
    roof.updateMatrixWorld(true);
    out.colliders.push(new THREE.Box3().setFromObject(roof));

    // Interior ceiling lights
    const lightPositions: [number, number, number][] = [
      [pos.x, floor1H - 0.4, pos.z - 6],
      [pos.x, floor1H - 0.4, pos.z + 6],
      [pos.x, totalH - 0.4, pos.z],
    ];
    for (const [lx, ly, lz] of lightPositions) {
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
      );
      fixture.position.set(lx, ly, lz);
      scene.add(fixture);

      const pt = new THREE.PointLight(0xfffbeb, 1.4, 14);
      pt.position.set(lx, ly - 0.2, lz);
      scene.add(pt);
      out.lights.push(pt);
    }

    // 6. Interactive Supply Lockers inside Admin Armory
    this.addSupplyLocker(scene, out, new THREE.Vector3(pos.x + w / 2 - 1.2, 0, pos.z + 6), -Math.PI / 2, 'locker_admin_1');
    this.addSupplyLocker(scene, out, new THREE.Vector3(pos.x + w / 2 - 1.2, 0, pos.z + 8), -Math.PI / 2, 'locker_admin_2');
    this.addSupplyLocker(scene, out, new THREE.Vector3(pos.x + w / 2 - 1.2, floor1H, pos.z - 4), -Math.PI / 2, 'locker_admin_2f');

    // 7. Exterior Main Power Breaker Box on West Facade
    this.addPowerBreakerBox(
      scene,
      out,
      new THREE.Vector3(pos.x - w / 2 - 0.48, 1.35, pos.z + 6),
      -Math.PI / 2,
      'breaker_admin_main'
    );

    return out;
  }

  /**
   * Builds a multi-bay Military Logistics Warehouse (30m x 42m x 9.0m) with
   * East loading dock bay, South personnel door, breakable clerestory windows,
   * steel support columns, and an elevated mezzanine catwalk (y = 3.6m) with stairs.
   */
  public static createEnterableWarehouse(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    wallMat: THREE.Material,
    metalMat: THREE.Material
  ): BuildingOutput {
    const out: BuildingOutput = {
      colliders: [],
      interactiveItems: [],
      breakableProps: [],
      lights: [],
    };

    const w = 30;
    const l = 42;
    const h = 9.0;
    const wallT = 0.9;
    const trimMat = TextureFactory.getMetalTrimMaterial();
    const walkMat = TextureFactory.getWalkwayMaterial(6, 8);

    // Concrete warehouse floor pad
    const floorPad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, l), walkMat);
    floorPad.position.set(pos.x, 0.07, pos.z);
    floorPad.receiveShadow = true;
    scene.add(floorPad);

    // West wall with high clerestory windows
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x - w / 2, 0, pos.z),
      length: l,
      height: h,
      thickness: wallT,
      axis: 'z',
      windowCount: 4,
      sillHeight: 4.5,
      windowHeight: 2.0,
      wallMat,
      trimMat,
      idPrefix: 'wh_west',
    });

    // North wall with windows
    this.addWallWithWindows(scene, out, {
      center: new THREE.Vector3(pos.x, 0, pos.z - l / 2),
      length: w,
      height: h,
      thickness: wallT,
      axis: 'x',
      windowCount: 3,
      sillHeight: 4.5,
      windowHeight: 2.0,
      wallMat,
      trimMat,
      idPrefix: 'wh_north',
    });

    // South wall with interactive personnel door
    this.addWallWithDoor(scene, out, {
      center: new THREE.Vector3(pos.x, 0, pos.z + l / 2),
      length: w,
      height: h,
      thickness: wallT,
      axis: 'x',
      doorOffset: 6,
      doorWidth: 2.6,
      doorHeight: 2.8,
      wallMat,
      trimMat,
      doorId: 'door_warehouse_south',
      addInteractiveDoor: true,
    });

    // East wall with wide 10m open cargo loading bay + rolled steel shutter header
    this.addWallWithDoor(scene, out, {
      center: new THREE.Vector3(pos.x + w / 2, 0, pos.z),
      length: l,
      height: h,
      thickness: wallT,
      axis: 'z',
      doorOffset: 0,
      doorWidth: 10,
      doorHeight: 5.2,
      wallMat,
      trimMat,
      addInteractiveDoor: false,
    });

    // Roof & Structural Roof Trusses
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.5, l + 1.4), metalMat);
    roof.position.set(pos.x, h + 0.25, pos.z);
    roof.castShadow = true;
    scene.add(roof);

    // Interior Mezzanine Catwalk along West/South side (y = 3.6m)
    const catwalkY = 3.6;
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 18), walkMat);
    catwalk.position.set(pos.x - w / 2 + 4.8, catwalkY - 0.15, pos.z + 9);
    catwalk.castShadow = true;
    catwalk.receiveShadow = true;
    scene.add(catwalk);
    catwalk.updateMatrixWorld(true);
    out.colliders.push(new THREE.Box3().setFromObject(catwalk));

    // Catwalk safety railing
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 18), trimMat);
    rail.position.set(pos.x - w / 2 + 8.7, catwalkY + 0.5, pos.z + 9);
    scene.add(rail);

    // Walk-up industrial staircase to Mezzanine Catwalk (from z = -7 up to z = 0)
    this.addStaircase(scene, out, {
      start: new THREE.Vector3(pos.x - w / 2 + 3.2, 0, pos.z - 8),
      end: new THREE.Vector3(pos.x - w / 2 + 3.2, catwalkY, pos.z),
      width: 2.4,
      steps: 9,
      mat: trimMat,
    });

    // Ground-level command desk at (pos.x, 0.45, pos.z + 5) so briefcase at (-32, 1.05, 10) sits cleanly on top
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.95, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 })
    );
    desk.position.set(pos.x, 0.48, pos.z + 5);
    desk.castShadow = true;
    scene.add(desk);
    desk.updateMatrixWorld(true);
    out.colliders.push(new THREE.Box3().setFromObject(desk));

    // Supply lockers inside warehouse
    this.addSupplyLocker(scene, out, new THREE.Vector3(pos.x - w / 2 + 1.2, 0, pos.z - 16), Math.PI / 2, 'locker_wh_1');
    this.addSupplyLocker(scene, out, new THREE.Vector3(pos.x - w / 2 + 1.2, catwalkY, pos.z + 14), Math.PI / 2, 'locker_wh_catwalk');

    // Interior overhead lights
    for (const lz of [pos.z - 12, pos.z, pos.z + 12]) {
      const pt = new THREE.PointLight(0xfef08a, 1.5, 18);
      pt.position.set(pos.x, h - 0.8, lz);
      scene.add(pt);
      out.lights.push(pt);
    }

    return out;
  }

  public static addSupplyLocker(
    scene: THREE.Scene,
    out: BuildingOutput,
    pos: THREE.Vector3,
    rotY: number,
    id: string
  ) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f4d3b, roughness: 0.5, metalness: 0.6 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4d5e48, roughness: 0.45, metalness: 0.65 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.65), bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.86, 0.06), doorMat);
    door.position.set(0, 1.0, 0.34);
    group.add(door);

    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    badge.position.set(0, 1.45, 0.36);
    group.add(badge);

    scene.add(group);
    group.updateMatrixWorld(true);
    out.colliders.push(new THREE.Box3().setFromObject(group));

    out.interactiveItems.push({
      id,
      type: 'locker',
      position: new THREE.Vector3(pos.x, pos.y + 1.0, pos.z),
      mesh: group,
      isCollected: false,
      label: 'TACTICAL SUPPLY LOCKER',
    });
  }

  public static addPowerBreakerBox(
    scene: THREE.Scene,
    out: BuildingOutput,
    pos: THREE.Vector3,
    rotY: number,
    id: string
  ) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 });
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.28), boxMat);
    group.add(boxMesh);

    const hazardStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    hazardStripe.position.set(0, 0.22, 0.02);
    group.add(hazardStripe);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    led.position.set(0, -0.2, 0.16);
    group.add(led);

    const pLight = new THREE.PointLight(0xfacc15, 0.9, 4.5);
    pLight.position.set(0, 0, 0.35);
    group.add(pLight);

    scene.add(group);

    out.interactiveItems.push({
      id,
      type: 'breaker_box',
      position: pos.clone(),
      mesh: group,
      isCollected: false,
      label: 'COMPOUND POWER BREAKER',
    });
  }
}
