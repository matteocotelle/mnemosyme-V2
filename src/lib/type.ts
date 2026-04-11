export interface Answer {
	text: string;
	id: number;
}

export interface PlayerStreak {
	current: number;
	max: number;
}

export interface Player {
	score: number;
	socketId: string;
	name: string;
	avatar?: string;
	isCreator?: boolean;
	isDisconnected?: boolean;
	streak?: PlayerStreak;
}

export interface Question {
	id: string;
	text: string;
	answers: string[];
	image?: string;
	type?: 'text' | 'image' | 'drawing';
	isTriple?: boolean;
	nextImage?: string | null;
}

export interface GameSettings {
	questionCount: 5 | 10 | 15 | 20;
	timerSeconds: 10 | 15 | 20 | 30;
	noRepeat: boolean;
	categories: string[];
}

export interface GameStats {
	totalQuestions: number;
	winnerCorrectAnswers: number;
	hardestQuestion: string;
	hardestQuestionCorrectRate: number;
	perfectScorers: string[];
	streaks: { playerName: string; maxStreak: number }[];
}

export interface GameState {
	creatorSocketId: string;
	status: 'lobby' | 'playing' | 'result';
	currentQuestion: Question | null;
	timer: number;
	players: Player[];
	roomCode: string;
	myPseudo: string;
	myAvatar: string;
	isCreator: boolean;
	leaderboard?: Player[];
	stats?: GameStats;
	settings: GameSettings;
	availableCategories: string[];
}

export interface ChatMessage {
	pseudo: string;
	avatar: string;
	message: string;
	timestamp: number;
}
