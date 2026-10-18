export type WeaponId = 'knife' | 'silenced_pistol' | 'ak74m' | 'sniper' | 'rpg7';

export interface WeaponData {
  id: WeaponId;
  name: string;
  slot: number;
  ammo: number;
  magSize: number;
  reserve: number;
  damage: number;
  fireRate: number; // shots per second
  range: number;
  spread: number;
  recoil: number;
  reloadTime: number; // seconds
  isSilenced: boolean;
  isAutomatic: boolean;
  zoomFov: number; // normal is 75
  description: string;
}

export type EnemyAlertState =
  | 'idle'
  | 'suspicious'
  | 'investigating'
  | 'combat'
  | 'taking_cover'
  | 'flanking'
  | 'dead';

export type EnemyRole = 'patrol' | 'sniper' | 'heavy' | 'officer';

export interface EnemyData {
  id: string;
  name: string;
  role: EnemyRole;
  health: number;
  maxHealth: number;
  alertState: EnemyAlertState;
  suspicionMeter: number; // 0 to 100
  position: [number, number, number];
  patrolPoints: [number, number, number][];
  currentPatrolIdx: number;
  lastKnownPlayerPos: [number, number, number] | null;
  shootCooldown: number;
  burstCount: number;
  isTagged?: boolean;
}

export interface SurveillanceCameraData {
  id: string;
  position: [number, number, number];
  angle: number;
  isDestroyed: boolean;
  baseAngle: number;
  sweepRange: number;
}

export interface MissionObjective {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isOptional: boolean;
  markerPos: [number, number, number];
}

export type GameState = 'menu' | 'briefing' | 'playing' | 'paused' | 'failed' | 'victory';

export interface GameStats {
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  alarmsTriggered: number;
  camerasDestroyed: number;
  stealthScore: number;
  timeElapsed: number; // in seconds
}

export interface GameSettings {
  mouseSensitivity: number; // 0.3 to 3.0, default 1.0
  invertY: boolean;
  fieldOfView: number; // 65 to 100, default 75
  masterVolume: number; // 0 to 100, default 80
  sfxVolume: number; // 0 to 100, default 85
  ambientVolume: number; // 0 to 100, default 70
  headBobbing: boolean;
  bobIntensity: number; // 0.2 to 2.0, default 1.0
  shadowQuality: 'off' | 'low' | 'high';
  postProcessing: boolean;
  crosshairStyle: 'classic' | 'dot' | 'circle';
  showDamageIndicators: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  invertY: false,
  fieldOfView: 75,
  masterVolume: 80,
  sfxVolume: 85,
  ambientVolume: 70,
  headBobbing: true,
  bobIntensity: 1.0,
  shadowQuality: 'high',
  postProcessing: true,
  crosshairStyle: 'classic',
  showDamageIndicators: true,
};

// --- MULTI-MISSION CAMPAIGN DEFINITIONS ---

export type MissionId = 'mission_01' | 'mission_02' | 'mission_03' | 'mission_04';

export type EnvironmentType = 'night_depot' | 'daylight_radar' | 'mountain_dawn' | 'harbor_storm';

export interface MissionDefinition {
  id: MissionId;
  index: number;
  codeName: string;
  title: string;
  subtitle: string;
  environment: EnvironmentType;
  timeOfDay: '02:40 NIGHT' | '12:15 HIGH NOON' | '05:30 DAWN' | '23:15 STORM';
  location: string;
  weather: string;
  threatLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREME';
  dossierSummary: string;
  briefingNotes: string[];
  primaryObjectives: {
    id: string;
    title: string;
    description: string;
    markerPos: [number, number, number];
  }[];
  secondaryObjectives: {
    id: string;
    title: string;
    description: string;
    markerPos: [number, number, number];
  }[];
  startPosition: [number, number, number];
  startYaw: number;
}

export interface MissionProgress {
  unlocked: boolean;
  completed: boolean;
  stars: number; // 0 to 3
  bestTime?: number;
  highestAccuracy?: number;
}

export type CampaignProgressRecord = Record<MissionId, MissionProgress>;

export const DEFAULT_CAMPAIGN_PROGRESS: CampaignProgressRecord = {
  mission_01: {
    unlocked: true,
    completed: false,
    stars: 0,
  },
  mission_02: {
    unlocked: false,
    completed: false,
    stars: 0,
  },
  mission_03: {
    unlocked: false,
    completed: false,
    stars: 0,
  },
  mission_04: {
    unlocked: false,
    completed: false,
    stars: 0,
  },
};

export const CAMPAIGN_MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_01',
    index: 1,
    codeName: 'OPERATION EAGLE EYE',
    title: 'Depot Infiltration',
    subtitle: 'Cold War Military Supply Base (Main Map)',
    environment: 'night_depot',
    timeOfDay: '02:40 NIGHT',
    location: 'Sector 7, Pripyat Outskirts',
    weather: 'Night Rain, Dense Mist (12°C)',
    threatLevel: 'NORMAL',
    dossierSummary:
      'Infiltrate the fortified military logistics compound under cover of night rain. Breach the two-story Administration Building to disable the security siren terminal, penetrate the central Logistics Warehouse to recover the encrypted briefcase from the upper office, and exfiltrate via the northern helipad.',
    briefingNotes: [
      'Doors, supply lockers, and compound power breaker boxes can be interacted with (F / E).',
      'Cutting the breaker box on the Admin exterior extinguishes compound floodlights to aid stealth.',
      'Press [G] to throw Fragmentation Grenades or [X] to plant/detonate C4 charges.',
      'Perimeter watchtowers are manned by Dragunov snipers with sweeping searchlights.',
    ],
    primaryObjectives: [
      {
        id: 'obj_alarm',
        title: 'Sabotage Security Siren Terminal',
        description: 'Enter the eastern Administration Building and hack the security siren console.',
        markerPos: [32, 1.2, -12],
      },
      {
        id: 'obj_briefcase',
        title: 'Recover Classified Intel Briefcase',
        description: 'Enter the western Logistics Warehouse and secure the encrypted briefcase from the command desk.',
        markerPos: [-32, 1.2, 10],
      },
      {
        id: 'obj_extract',
        title: 'Exfiltrate via Helipad',
        description: 'Proceed to the northern helicopter pad and board the UH-60A BlackHawk.',
        markerPos: [0, 0.5, -48],
      },
    ],
    secondaryObjectives: [
      {
        id: 'obj_snipers',
        title: 'Neutralize Watchtower Snipers',
        description: 'Eliminate both elevated tower marksmen overlooking the compound.',
        markerPos: [45, 9.5, 45],
      },
      {
        id: 'obj_power_grid',
        title: 'Cut Compound Breaker Box',
        description: 'Disable the main electrical breaker panel to plunge interior rooms into darkness.',
        markerPos: [21.5, 1.3, -4],
      },
    ],
    startPosition: [0, 1.7, 58],
    startYaw: Math.PI,
  },
  {
    id: 'mission_02',
    index: 2,
    codeName: 'OPERATION SUNBURST',
    title: 'Radar Telemetry Station',
    subtitle: 'Desert Long-Range Surveillance Array',
    environment: 'daylight_radar',
    timeOfDay: '12:15 HIGH NOON',
    location: 'Karakum Desert Outpost, Grid 44-B',
    weather: 'Arid Sun, Sandstorm Gusts (38°C)',
    threatLevel: 'ELEVATED',
    dossierSummary:
      'Under the harsh glare of high noon daylight, guards have extended sightlines across open sand courtyards. Infiltrate the communication outpost, cut power to the tracking radar by sabotaging generator turbines, hack the satellite dish uplink terminal, eliminate the garrison communications officer, and exfiltrate.',
    briefingNotes: [
      'Daylight conditions grant enemy guards 40% wider sight detection ranges in open terrain.',
      'Use enterable bunkers, shipping containers, and sandbag trenches for rigid ballistic cover.',
      'Generator turbine sabotage disables perimeter electric fencing and alarms.',
      'Communications officer carries encrypted security override keys.',
    ],
    primaryObjectives: [
      {
        id: 'obj_generator',
        title: 'Sabotage Power Generator Grid',
        description: 'Shut down the high-voltage turbine supplying radar transmitter arrays.',
        markerPos: [-28, 1.2, -18],
      },
      {
        id: 'obj_radar_hack',
        title: 'Hack Satellite Telemetry Uplink',
        description: 'Upload decryption payload at the central dish telemetry console.',
        markerPos: [24, 1.2, 16],
      },
      {
        id: 'obj_extract',
        title: 'Exfiltrate via Desert Gate',
        description: 'Fight through perimeter security and exfiltrate at the northern canyon gate.',
        markerPos: [0, 0.5, -55],
      },
    ],
    secondaryObjectives: [
      {
        id: 'obj_officer',
        title: 'Eliminate Communications Officer',
        description: 'Neutralize the garrison comms officer stationed near the command outpost.',
        markerPos: [0, 1.2, -8],
      },
    ],
    startPosition: [0, 1.7, 58],
    startYaw: Math.PI,
  },
  {
    id: 'mission_03',
    index: 3,
    codeName: 'OPERATION IRON DAWN',
    title: 'Mountain Silo Stronghold',
    subtitle: 'Subterranean Strategic Missile Complex',
    environment: 'mountain_dawn',
    timeOfDay: '05:30 DAWN',
    location: 'Ural Mountains Redoubt, Peak 204',
    weather: 'Dawn Alpine Mist, Drifting Snow (-4°C)',
    threatLevel: 'HIGH',
    dossierSummary:
      'A heavily fortified terraced mountain bastion built into granite peaks. At first dawn light, penetrate the blast doors of the subterranean strategic missile complex, override the nuclear silo launch computer, neutralize the elite Spetsnaz base commander, and escape to the rooftop mountain helipad.',
    briefingNotes: [
      'Heavy Spetsnaz infantry patrolling in Kevlar armor with enhanced combat durability.',
      'Terraced mountain pillboxes overlook central approach corridors—advance methodically.',
      'Breach the underground silo control room to abort the strategic launch countdown.',
      'Extraction helicopter awaits on the northern helipad once primary objectives are complete.',
    ],
    primaryObjectives: [
      {
        id: 'obj_silo_override',
        title: 'Override Missile Silo Launch Terminal',
        description: 'Breach the control room and abort the strategic launch countdown.',
        markerPos: [-30, 1.2, -2],
      },
      {
        id: 'obj_commander',
        title: 'Neutralize Base Commander Zaitsev',
        description: 'Eliminate the Spetsnaz fortress commander inside the eastern command bunker.',
        markerPos: [25, 1.2, -15],
      },
      {
        id: 'obj_extract',
        title: 'Extract via Mountain Helipad',
        description: 'Proceed to the mountain redoubt helipad and board the extraction transport.',
        markerPos: [0, 0.5, -50],
      },
    ],
    secondaryObjectives: [
      {
        id: 'obj_bunker_breach',
        title: 'Sabotage Substation Backup Power',
        description: 'Disable backup emergency diesel dynamos in the southeastern pillbox.',
        markerPos: [32, 1.2, 22],
      },
    ],
    startPosition: [0, 1.7, 58],
    startYaw: Math.PI,
  },
  {
    id: 'mission_04',
    index: 4,
    codeName: 'OPERATION BLACK TIDE',
    title: 'Harbor Naval Dockyard',
    subtitle: 'Submarine Logistics & Cargo Terminal',
    environment: 'harbor_storm',
    timeOfDay: '23:15 STORM',
    location: 'Murmansk Naval Pier, Sector 12',
    weather: 'Heavy Coastal Storm, Driving Rain (4°C)',
    threatLevel: 'EXTREME',
    dossierSummary:
      'Infiltrate the high-security naval cargo terminal during a coastal storm. Plant demolition C4 charges on the armored fuel manifold, retrieve the naval cipher ledger from the dockyard harbourmaster office, disable the coastal radar beacon, and extract via the pier helipad.',
    briefingNotes: [
      'Labyrinthine shipping container lanes provide tight CQB flanking routes.',
      'Elite naval guards coordinate via radio—eliminate officers quickly before backup arrives.',
      'Plant C4 or interact with the fuel manifold and radar terminal to cripple port operations.',
      'Use elevated watchtowers for overwatch across the cargo yard.',
    ],
    primaryObjectives: [
      {
        id: 'obj_c4_manifold',
        title: 'Demolish Armored Fuel Manifold',
        description: 'Plant C4 charges on the western fuel depot manifold.',
        markerPos: [-32, 1.2, -12],
      },
      {
        id: 'obj_briefcase',
        title: 'Secure Naval Cipher Briefcase',
        description: 'Infiltrate the eastern port authority building and steal the cipher briefcase.',
        markerPos: [32, 1.2, 8],
      },
      {
        id: 'obj_extract',
        title: 'Exfiltrate via Pier Helipad',
        description: 'Reach the northern dockyard helipad for storm extraction.',
        markerPos: [0, 0.5, -52],
      },
    ],
    secondaryObjectives: [
      {
        id: 'obj_alarm',
        title: 'Disable Port Security Siren',
        description: 'Shut down the harbourmaster alarm console.',
        markerPos: [28, 1.2, -14],
      },
      {
        id: 'obj_snipers',
        title: 'Eliminate Crane & Tower Snipers',
        description: 'Neutralize the dockyard marksmen overlooking the container lanes.',
        markerPos: [46, 9.5, 46],
      },
    ],
    startPosition: [0, 1.7, 58],
    startYaw: Math.PI,
  },
];
