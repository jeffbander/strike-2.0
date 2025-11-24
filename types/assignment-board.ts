// Assignment Board Types
// Adapted from v0 design for Strike Prep system

export type ShiftStatus = 'Open' | 'Pending' | 'Filled';

export type MatchType = 'Perfect' | 'Good' | 'Partial';

export interface BoardShift {
  id: string;
  name: string;
  role: string;
  time: string;
  status: ShiftStatus;
  jobCode: string;
  skills: string[];
  jobPositionId: string;
}

export interface BoardService {
  id: string;
  name: string;
  unfilledCount: number;
  shifts: BoardShift[];
}

export interface BoardHospital {
  id: string;
  name: string;
  shortCode: string;
  unfilledCount: number;
  services: BoardService[];
}

export interface BoardProvider {
  id: string;
  name: string;
  jobCode: string;
  department: string;
  hospital: string;
  skills: string[];
  missingSkills?: string[];
  matchType: MatchType;
  score: number;
}

export interface AssignmentBoardData {
  hospitals: BoardHospital[];
  stats: {
    totalPositions: number;
    openPositions: number;
    assignedPositions: number;
    pendingPositions: number;
    coveragePercent: number;
  };
}

export interface MatchingResponse {
  providers: BoardProvider[];
  perfectCount: number;
  goodCount: number;
  partialCount: number;
}
