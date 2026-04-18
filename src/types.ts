export interface SquadPlayer {
  id: string;
  name: string;
  position?: string;
  number?: string;
  photoUrl?: string;
}

export interface LineupPlayer {
  id: string;
  playerId: string;
  x: number; // 0-100 percent
  y: number; // 0-100 percent
  isSubstitute: boolean;
}

export interface Lineup {
  id: string;
  matchTitle: string;
  teamName?: string;
  date: number;
  players: LineupPlayer[];
  playerScale?: number; // 0.5 to 1.5
  nameTagStyle?: 'light' | 'dark';
  nameDisplayMode?: 'first' | 'last' | 'full';
  showNameBackground?: boolean;
  nameBackgroundType?: 'classic' | 'badge' | 'minimal';
  formation?: string;
  showPhoto?: boolean;
  showNumber?: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  playerIds: string[];
}

export interface PeriodStandings {
  playerId: string;
  playerName: string;
  points: number;
}

export interface Period {
  id: string;
  name: string;
  startDate: number;
  endDate?: number; // Optional, if present the period is closed
  standings: PeriodStandings[];
  isActive?: boolean; // New field to track which period is currently active for new exercises
  shareId?: string; // ID for the shared version of this period
}

export interface PointsConfig {
  first: number;
  second: number;
  third: number;
}

export interface Exercise {
  id: string;
  name: string;
  icon: string;
  date: number;
  teams: Team[];
  sortByScore: boolean;
  showTimer: boolean;
  defaultTimerMinutes: number;
  defaultTimerSeconds: number;
  createdAt: number;
  updatedAt: number;
  isFinished?: boolean;
  jokerPlayerIds?: string[];
  pointsConfig?: PointsConfig;
  periodId?: string;
}

// Keep these for backward compatibility during transition if needed, 
// but we'll migrate the app to use Exercise and Team.
export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface Game extends Exercise {
  players: Player[]; // This will be deprecated
}

export const GAME_ICONS = [
  'Trophy',
  'Gamepad2',
  'Dice5',
  'Target',
  'Sword',
  'Shield',
  'Crown',
  'Star',
  'Heart',
  'Zap',
  'Flame',
  'Ghost',
  'Skull',
  'Rocket',
  'Car',
  'Bike',
  'Footprints',
  'Dribbble',
  'Music',
  'Coffee',
];

export const PRESET_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#0ea5e9", // sky-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#71717a", // zinc-500
  "#4b5563", // gray-600
  "#1e3a8a", // blue-900 (navy)
  "#18181b", // zinc-950
  "#ffffff", // white
];
