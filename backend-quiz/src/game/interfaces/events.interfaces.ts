import type { Player, RoomPhase, PlayerStreak } from './game.interfaces';
import type { GameSettings } from '../game.constants';

// --- Client → Server ---

export interface CreateRoomPayload {
  pseudo: string;
  avatar?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  pseudo: string;
  name?: string; // backward compat alias
  avatar?: string;
}

export interface UpdateGameSettingsPayload {
  roomId: string;
  settings: Partial<GameSettings>;
}

export interface StartGamePayload {
  roomId: string;
}

export interface SubmitAnswerPayload {
  roomId: string;
  answer: string;
  questionIndex: number;
}

export interface ToggleValidationPayload {
  roomId: string;
  targetSocketId: string;
}

export interface ValidateAllPayload {
  roomId: string;
  isCorrect: boolean;
}

export interface NextCorrectionPayload {
  roomId: string;
}

export interface RestartGamePayload {
  roomId: string;
}

export interface ChatMessagePayload {
  roomId: string;
  message: string;
}

export interface RequestRoomDataPayload {
  roomId: string;
}

// --- Server → Client ---

export interface RoomDataEvent {
  roomId: string;
  players: Player[];
  creatorSocketId: string;
  phase: RoomPhase;
  settings: GameSettings;
}

export interface NewQuestionEvent {
  index: number;
  total: number;
  text: string;
  image: string | null;
  seconds: number;
  type: 'text' | 'image' | 'opinion' | 'drawing';
  choices?: [string, string]; // only for opinion type
  isTriple: boolean;
  nextImage?: string | null; // prefetch next question's image
}

export interface TimerSyncEvent {
  remainingMs: number;
  questionIndex: number;
}

export interface StreakUpdateEvent {
  socketId: string;
  playerName: string;
  currentStreak: number;
}

export interface CorrectionPlayerData {
  socketId: string;
  name: string;
  avatar: string;
  answer: string;
  isCorrect: boolean | undefined;
  isDisconnected: boolean;
}

export interface CorrectionStateEvent {
  questionIndex: number;
  total: number;
  question: {
    text: string;
    answer: string;
    image: string | null;
    points: number;
    effectivePoints: number; // points after triple multiplier
    type: 'text' | 'image' | 'opinion' | 'drawing';
    choices?: [string, string];
    isTriple: boolean;
  };
  players: CorrectionPlayerData[];
  opinionResult?: {
    majorityChoice: string; // winning choice or 'TIE'
    votes: { choice: string; count: number }[];
    isTie: boolean;
  };
}

export interface GameStats {
  totalQuestions: number;
  winnerCorrectAnswers: number;
  hardestQuestion: string;
  hardestQuestionCorrectRate: number;
  perfectScorers: string[];
  streaks: { playerName: string; maxStreak: number }[];
}

export interface CorrectionFinishedEvent {
  leaderboard: Player[];
  stats: GameStats;
}

export interface ReconnectionStateEvent {
  phase: RoomPhase;
  roomData: RoomDataEvent;
  currentQuestion?: NewQuestionEvent;
  remainingMs?: number;
  correctionState?: CorrectionStateEvent;
  leaderboard?: Player[];
  stats?: GameStats;
}

export interface AvailableCategoriesEvent {
  categories: string[];
}
