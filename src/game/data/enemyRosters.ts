import type { EnemyRole, MissionId } from '../../types/game';

export interface EnemySpawnConfig {
  id: string;
  name: string;
  role: EnemyRole;
  pos: [number, number, number];
  patrol: [number, number, number][];
  health: number;
}

const MISSION_01: EnemySpawnConfig[] = [
  { id: 'guard_gate', name: 'Gate Sentry Ivanov', role: 'patrol', pos: [5, 0, 48], patrol: [[5, 0, 48], [-5, 0, 48], [5, 0, 56]], health: 80 },
  { id: 'guard_courtyard', name: 'Patrol Sergeant Morozov', role: 'patrol', pos: [0, 0, 20], patrol: [[0, 0, 20], [16, 0, 20], [16, 0, -5], [0, 0, -5]], health: 90 },
  { id: 'guard_warehouse_dock', name: 'Warehouse Guard Petrov', role: 'patrol', pos: [-14, 0, 12], patrol: [[-14, 0, 12], [-14, 0, -8], [-10, 0, 2]], health: 85 },
  { id: 'guard_warehouse_interior', name: 'Special Security Volkov', role: 'heavy', pos: [-28, 0, 6], patrol: [[-28, 0, 6], [-34, 0, 6], [-28, 0, 14]], health: 120 },
  { id: 'guard_admin', name: 'Office Guard Kozlov', role: 'patrol', pos: [20, 0, -10], patrol: [[20, 0, -10], [20, 0, -2], [28, 0, -10]], health: 85 },
  { id: 'guard_motorpool', name: 'Motor Pool Guard Lebedev', role: 'patrol', pos: [-6, 0, -26], patrol: [[-6, 0, -26], [10, 0, -26], [10, 0, -16]], health: 85 },
  { id: 'sniper_se', name: 'Tower Sniper Sokolov', role: 'sniper', pos: [45, 9.2, 45], patrol: [[45, 9.2, 45]], health: 65 },
  { id: 'sniper_nw', name: 'Tower Sniper Belov', role: 'sniper', pos: [-45, 9.2, -45], patrol: [[-45, 9.2, -45]], health: 65 },
];

const MISSION_02: EnemySpawnConfig[] = [
  { id: 'guard_gate_desert', name: 'Gate Sentry Rashidov', role: 'patrol', pos: [0, 0, 52], patrol: [[0, 0, 52], [-8, 0, 52], [8, 0, 52]], health: 85 },
  { id: 'guard_radar_courtyard', name: 'Courtyard Patrol Alimov', role: 'patrol', pos: [10, 0, 30], patrol: [[10, 0, 30], [24, 0, 30], [24, 0, 5], [10, 0, 5]], health: 90 },
  { id: 'guard_generator', name: 'Substation Guard Tursunov', role: 'heavy', pos: [-24, 0, -14], patrol: [[-24, 0, -14], [-32, 0, -14], [-32, 0, -22]], health: 120 },
  { id: 'guard_officer', name: 'Comms Officer Major Sorokin', role: 'officer', pos: [0, 0, -8], patrol: [[0, 0, -8], [-5, 0, -8], [5, 0, -8]], health: 140 },
  { id: 'sniper_se_desert', name: 'Tower Sniper Kasymov', role: 'sniper', pos: [50, 9.2, 50], patrol: [[50, 9.2, 50]], health: 70 },
  { id: 'sniper_nw_desert', name: 'Tower Sniper Dzhuraev', role: 'sniper', pos: [-50, 9.2, -50], patrol: [[-50, 9.2, -50]], health: 70 },
];

const MISSION_03: EnemySpawnConfig[] = [
  { id: 'guard_mountain_gate', name: 'Bastion Sentry Romanov', role: 'patrol', pos: [0, 0, 52], patrol: [[0, 0, 52], [-6, 0, 52], [6, 0, 52]], health: 90 },
  { id: 'guard_silo_pit', name: 'Silo Perimeter Heavy Borisov', role: 'heavy', pos: [0, 0, 16], patrol: [[0, 0, 16], [-10, 0, 16], [10, 0, 16]], health: 140 },
  { id: 'guard_dynamo', name: 'Pillbox Dynamo Guard Fedorov', role: 'patrol', pos: [28, 0, 18], patrol: [[28, 0, 18], [34, 0, 18], [34, 0, 24]], health: 95 },
  { id: 'guard_commander', name: 'Base Commander Col. Zaitsev', role: 'officer', pos: [25, 0, -15], patrol: [[25, 0, -15], [20, 0, -15], [20, 0, -10]], health: 180 },
  { id: 'sniper_se_mountain', name: 'Mountain Marksman Gerasimov', role: 'sniper', pos: [45, 9.2, 45], patrol: [[45, 9.2, 45]], health: 75 },
  { id: 'sniper_nw_mountain', name: 'Mountain Marksman Chernov', role: 'sniper', pos: [-45, 9.2, -45], patrol: [[-45, 9.2, -45]], health: 75 },
];

const MISSION_04: EnemySpawnConfig[] = [
  { id: 'guard_dock_gate', name: 'Port Sentry Karpov', role: 'patrol', pos: [0, 0, 50], patrol: [[0, 0, 50], [-8, 0, 50], [8, 0, 50]], health: 95 },
  { id: 'guard_container_lane', name: 'Cargo Yard Heavy Orlov', role: 'heavy', pos: [-8, 0, 18], patrol: [[-8, 0, 18], [8, 0, 18], [8, 0, -4], [-8, 0, -4]], health: 145 },
  { id: 'guard_fuel_manifold', name: 'Manifold Guard Kuznetsov', role: 'heavy', pos: [-26, 0, -10], patrol: [[-26, 0, -10], [-36, 0, -10], [-32, 0, -20]], health: 135 },
  { id: 'guard_harbourmaster', name: 'Naval Captain Voronin', role: 'officer', pos: [26, 0, 6], patrol: [[26, 0, 6], [26, 0, -8], [32, 0, 6]], health: 170 },
  { id: 'guard_pier_north', name: 'Pier Patrol Makarov', role: 'patrol', pos: [6, 0, -32], patrol: [[6, 0, -32], [-10, 0, -32], [-10, 0, -20]], health: 95 },
  { id: 'sniper_se_dock', name: 'Crane Marksman Tarasov', role: 'sniper', pos: [46, 9.2, 46], patrol: [[46, 9.2, 46]], health: 75 },
  { id: 'sniper_nw_dock', name: 'Tower Marksman Krylov', role: 'sniper', pos: [-46, 9.2, -46], patrol: [[-46, 9.2, -46]], health: 75 },
];

const ROSTERS: Record<MissionId, EnemySpawnConfig[]> = {
  mission_01: MISSION_01,
  mission_02: MISSION_02,
  mission_03: MISSION_03,
  mission_04: MISSION_04,
};

export function getEnemyRoster(missionId: MissionId): EnemySpawnConfig[] {
  return ROSTERS[missionId] ?? MISSION_01;
}
