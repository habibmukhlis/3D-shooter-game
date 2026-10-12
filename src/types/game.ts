export type WeaponId = 'knife' | 'silenced_pistol' | 'ak74m' | 'sniper';

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

export type EnemyAlertState = 'idle' | 'suspicious' | 'investigating' | 'combat' | 'dead';

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

export type MissionId = 'mission_01' | 'mission_02' | 'mission_03';

export interface MissionDefinition {
  id: MissionId;
  index: number;
  codeName: string;
  title: string;
  subtitle: string;
  environment: 'night_depot' | 'daylight_radar' | 'mountain_dawn';
  timeOfDay: '02:40 NIGHT' | '12:15 HIGH NOON' | '05:30 DAWN';
  location: string;
  weather: string;
  threatLevel: 'NORMAL' | 'ELEVATED' | 'HIGH';
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
};

export const CAMPAIGN_MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_01',
    index: 1,
    codeName: 'OPERATION EAGLE EYE',
    title: 'Depot Infiltration',
    subtitle: 'Cold War Military Supply Base',
    environment: 'night_depot',
    timeOfDay: '02:40 NIGHT',
    location: 'Sector 7, Pripyat Outskirts',
    weather: 'Dense Night Mist, Overcast (12°C)',
    threatLevel: 'NORMAL',
    dossierSummary:
      'Infiltrate the heavily fortified logistics depot under cover of night darkness. Deactivate the base security siren console, eliminate perimeter watchtower snipers, secure classified briefcase intel from the central warehouse, and exfiltrate via the northern helipad.',
    briefingNotes: [
      'Night vision goggles (N) recommended for scouting shadowed perimeter corridors.',
      'Perimeter towers are manned by Dragunov snipers equipped with high-intensity spotlights.',
      'Disable the base alarm in the admin building before accessing the warehouse logistics desk.',
      'Silenced pistol eliminates guards quietly without sounding compound-wide alert.',
    ],
    primaryObjectives: [
      {
        id: 'obj_alarm',
        title: 'Sabotage Security Siren Terminal',
        description: 'Locate security terminal in administrative office building and cut sirens.',
        markerPos: [32, 1.2, -12],
      },
      {
        id: 'obj_briefcase',
        title: 'Recover Classified Intel Briefcase',
        description: 'Infiltrate warehouse and steal the encrypted logistics briefcase.',
        markerPos: [-32, 1.2, 10],
      },
      {
        id: 'obj_extract',
        title: 'Exfiltrate via Helipad',
        description: 'Proceed to the north helicopter landing pad for extraction extraction.',
        markerPos: [0, 0.5, -48],
      },
    ],
    secondaryObjectives: [
      {
        id: 'obj_snipers',
        title: 'Neutralize Watchtower Snipers',
        description: 'Eliminate both elevated tower sentries overlooking the compound perimeter.',
        markerPos: [45, 9.5, 45],
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
    weather: 'Arid Sun, Clear Skies, Heat Shimmer (38°C)',
    threatLevel: 'ELEVATED',
    dossierSummary:
      'Under the harsh glare of high noon daylight, guards have extended sightlines across open sand courtyards. Infiltrate the communication outpost, cut power to the tracking radar by sabotaging generator turbines, hack the satellite dish uplink terminal, eliminate the garrison communications officer, and exfiltrate.',
    briefingNotes: [
      'Daylight conditions grant enemy guards 50% wider sight detection ranges in open terrain.',
      'Use sandbag bunkers, shipping containers, and vehicle wrecks for rigid ballistic cover.',
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
        description: 'Neutralize the garrison comms officer stationed inside the control bunker.',
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
    weather: 'Dawn Alpine Mist, Freezing Winds (-4°C)',
    threatLevel: 'HIGH',
    dossierSummary:
      'A heavily fortified terraced mountain bastion built into granite peaks. At first dawn light, penetrate the blast doors of the subterranean strategic missile complex, override the nuclear silo launch computer, neutralize the elite Spetsnaz base commander, and escape to the rooftop mountain helipad.',
    briefingNotes: [
      'Heavy Spetsnaz infantry patrolling in Kevlar armor with enhanced combat durability.',
      'Terraced mountain pillboxes overlook central approach corridors—advance methodically.',
      'Subterranean silo console has a 4-minute launch abort sequence upon breach.',
      'Extraction helicopter will deploy smoke signals on the mountain helipad once commander is eliminated.',
    ],
    primaryObjectives: [
      {
        id: 'obj_silo_override',
        title: 'Override Missile Silo Launch Terminal',
        description: 'Breach the underground control room and abort the strategic launch countdown.',
        markerPos: [-30, 1.2, -2],
      },
      {
        id: 'obj_commander',
        title: 'Neutralize Base Commander Zaitsev',
        description: 'Eliminate the Spetsnaz fortress commander commanding the mountain redoubt.',
        markerPos: [25, 1.2, -15],
      },
      {
        id: 'obj_extract',
        title: 'Extract via Mountain Helipad',
        description: 'Climb to the mountain redoubt upper helipad and board the extraction transport.',
        markerPos: [0, 0.5, -50],
      },
    ],
    secondaryObjectives: [
      {
        id: 'obj_bunker_breach',
        title: 'Sabotage Substation Backup Power',
        description: 'Disable backup emergency diesel dynamos in the eastern pillbox.',
        markerPos: [32, 1.2, 22],
      },
    ],
    startPosition: [0, 1.7, 58],
    startYaw: Math.PI,
  },
];
