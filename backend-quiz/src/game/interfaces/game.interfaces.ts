import type { Question } from '../../questions/questions.interfaces';
import type { GameSettings } from '../game.constants';

export type RoomPhase = 'lobby' | 'playing' | 'correction' | 'result';

export interface PlayerStreak {
  current: number;
  max: number;
}

export interface Player {
  socketId: string;
  name: string;
  score: number;
  avatar: string;
  isDisconnected: boolean;
  streak: PlayerStreak;
}

export interface PlayerAnswer {
  questionIndex: number;
  socketId: string;
  answer: string;
  submittedAt: number;
}

export interface TimerState {
  intervalRef: NodeJS.Timeout | null;
  questionStartedAt: number;
  durationMs: number;
}

export interface Room {
  id: string;
  creatorSocketId: string;
  players: Player[];
  phase: RoomPhase;
  settings: GameSettings;
  questions: Question[];
  previousQuestionIds: string[];
  currentQuestionIndex: number;
  answers: PlayerAnswer[];
  timer: TimerState;
  correctionQuestionIndex: number;
  validatedAnswers: Map<string, boolean>;
  opinionResults: Map<number, string>; // questionIndex → majority choice or 'TIE'
  tripleQuestionIndices: number[]; // indices of questions worth x3 points
  lastActivityAt: number;
}
