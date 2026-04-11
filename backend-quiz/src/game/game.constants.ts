export const ALLOWED_QUESTION_COUNTS = [5, 10, 15, 20] as const;
export const ALLOWED_TIMER_SECONDS = [10, 15, 20, 30] as const;
export const MAX_PLAYERS_PER_ROOM = 8;
export const MAX_CONCURRENT_ROOMS = 10;
export const ROOM_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const QUESTION_TRANSITION_DELAY_MS = 2000;
export const ANTI_CHEAT_GRACE_MS = 500; // grace period for network latency
export const CHAT_MAX_LENGTH = 200;
export const ROOM_CLEANUP_INTERVAL_MS = 60_000; // check every 60s

export interface GameSettings {
  questionCount: (typeof ALLOWED_QUESTION_COUNTS)[number];
  timerSeconds: (typeof ALLOWED_TIMER_SECONDS)[number];
  noRepeat: boolean;
  categories: string[]; // empty = all
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  questionCount: 10,
  timerSeconds: 20,
  noRepeat: true,
  categories: [],
};
