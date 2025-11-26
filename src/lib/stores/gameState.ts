// src/lib/stores/gameState.ts
import { writable } from 'svelte/store';
import type { GameState } from '$lib/type';

// État initial vide mais typé
const initialState: GameState = {
    status: 'lobby',
    currentQuestion: null,
    timer: 0,
    players: [],
    roomCode: '',
    myPseudo: '',
    isCreator: false,
    creatorSocketId: undefined
};

// <GameState> indique à TS que ce store respectera TOUJOURS l'interface GameState
export const game = writable<GameState>(initialState);

// Helpers optionnels
export const resetGame = () => {
    game.set(initialState);
};