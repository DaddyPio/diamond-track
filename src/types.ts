export interface RatingCategory {
  weights: {
    batting: number;
    pitching: number;
    fielding: number;
    speed: number;
    stamina: number;
  };
  levels: {
    S: number;
    A: number;
    B: number;
    C: number;
  };
}

export interface RatingStandard {
  fielder: RatingCategory;
  twoWay: RatingCategory;
}

export interface Team {
  id: string;
  name: string;
  coachUid: string;
  createdAt: any;
}

export interface PerformanceRecord {
  id?: string;
  playerUid: string;
  teamId: string;
  date: any; // Firestore Timestamp
  type: 'game' | 'test';
  stats: {
    // Game stats
    avg?: number;
    obp?: number;
    hr?: number;
    rbi?: number;
    era?: number;
    wins?: number;
    plateAppearances?: number;
    atBats?: number;
    hits?: number;
    walks?: number;
    strikeouts?: number;
    runs?: number;
    doubles?: number;
    triples?: number;
    stolenBases?: number;
    inningsPitched?: number;
    runsAllowed?: number;
    earnedRuns?: number;
    hitsAllowed?: number;
    pitcherWalks?: number;
    pitcherStrikeouts?: number;
    totalPitches?: number;
    strikes?: number;
    balls?: number;
    // Test stats
    runningSpeed?: number;
    pitchingVelocity?: number;
    throwingDistance?: number;
  };
}

export interface AttendanceRecord {
  id?: string;
  teamId: string;
  date: string; // YYYY-MM-DD
  presentUids: string[];
  absentUids: string[];
}

export interface InstructionCompletion {
  instructionId: string;
  playerUid: string;
  teamId: string;
  completedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'coach' | 'player';
  playerType?: 'fielder' | 'twoWay';
  teamId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  playerNumber?: string;
  position?: string;
  bio?: string;
  stats?: {
    batting: number;
    pitching: number;
    fielding: number;
    speed: number;
    stamina: number;
  };
  gameStats?: {
    avg: number;
    obp: number;
    hr: number;
    rbi: number;
    era: number;
    wins: number;
  };
  testStats?: {
    runningSpeed: number; // 跑壘速度 (秒)
    pitchingVelocity: number; // 球速 (km/h)
    throwingDistance: number; // 投遠距離 (m)
    updatedAt: any;
  };
}

export interface TrainingLog {
  id?: string;
  playerUid: string;
  teamId: string;
  date: any; // Firestore Timestamp
  type: string;
  description: string;
  duration: number;
  coachFeedback?: string;
  instructionId?: string;
}

export interface Instruction {
  id?: string;
  coachUid: string;
  teamId: string;
  targetUid: string; // playerUid or 'team' or 'custom'
  targetUids?: string[]; // for custom groups
  title: string;
  content: string;
  dueDate?: string;
  createdAt: any; // Firestore Timestamp
  isRead: boolean;
}

export interface Notification {
  id?: string;
  recipientUid: string;
  teamId: string;
  title: string;
  content: string;
  type: 'instruction' | 'feedback' | 'completion';
  relatedId?: string;
  isRead: boolean;
  createdAt: any;
}
