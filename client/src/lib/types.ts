export type GoalValue = 1 | 2 | 3 | 4 | 'full';
export type SquareState = 'empty' | 'possible' | 'marked';

export interface PlayerPublic {
  id: string;
  name: string;
  bingos: number;
  connected: boolean;
}

export interface RoomSnapshot {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  currentGoal: GoalValue;
  currentTrackId: string | null;
  playedTrackIds: string[];
  players: PlayerPublic[];
  playlistName: string;
  trackCount: number;
}

export interface TrackInfo {
  id: string;
  uri: string;
  name: string;
  artists: string[];
}

export interface PlayerBoard {
  id: string;
  name: string;
  board: string[];   // 25 entries; '__FREE__' at index 12
  marks: SquareState[];
  bingos: number;
}

export interface ClaimPayload {
  playerId: string;
  name: string;
  validLines: number[];
  board: string[];
  marks: SquareState[];
  isValid: boolean;
  currentGoal: GoalValue;
}

export const FREE_CELL = '__FREE__';

export function goalLabel(g: GoalValue): string {
  if (g === 'full') return 'Full board';
  if (g === 1) return '1 bingo';
  return `${g} bingos`;
}
