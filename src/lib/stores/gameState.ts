import { writable, get } from 'svelte/store';
import type { GameState } from '$lib/type';
import { AVATAR_SEEDS } from '$lib/avatars';

const SESSION_KEY = 'mnemosyme-session';

function loadSession(): { roomCode: string; myPseudo: string; myAvatar: string } | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function saveSession(state: GameState): void {
	if (typeof window === 'undefined') return;
	if (state.roomCode) {
		sessionStorage.setItem(
			SESSION_KEY,
			JSON.stringify({
				roomCode: state.roomCode,
				myPseudo: state.myPseudo,
				myAvatar: state.myAvatar,
			})
		);
	} else {
		sessionStorage.removeItem(SESSION_KEY);
	}
}

const saved = loadSession();

const initialState: GameState = {
	status: 'lobby',
	currentQuestion: null,
	timer: 0,
	players: [],
	roomCode: saved?.roomCode || '',
	myPseudo: saved?.myPseudo || '',
	myAvatar: saved?.myAvatar || AVATAR_SEEDS[0],
	isCreator: false,
	creatorSocketId: '',
	settings: {
		questionCount: 10,
		timerSeconds: 20,
		noRepeat: true,
		categories: [],
	},
	availableCategories: [],
};

export const game = writable<GameState>(initialState);

// Persist session on every change
game.subscribe(saveSession);

export const resetGame = () => {
	game.set({
		...initialState,
		roomCode: '',
		myPseudo: '',
		myAvatar: AVATAR_SEEDS[0],
	});
};
