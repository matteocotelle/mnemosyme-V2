import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { writable, get } from 'svelte/store';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
import { game } from './gameState';

export const isConnected = writable<boolean>(false);

const URL = PUBLIC_BACKEND_URL || 'http://localhost:3000';

export const socket: Socket = io(URL, {
	autoConnect: false,
});

socket.on('connect', () => {
	isConnected.set(true);
	console.log('✅ Socket connecté');

	// Auto-rejoin room on reconnect (e.g. after page refresh)
	const state = get(game);
	if (state.roomCode && state.myPseudo) {
		console.log('🔄 Tentative de reconnexion à la room', state.roomCode);
		socket.emit('joinRoom', {
			roomId: state.roomCode,
			pseudo: state.myPseudo,
			avatar: state.myAvatar,
		});
	}
});

socket.on('disconnect', () => {
	isConnected.set(false);
	console.log('🔴 Socket déconnecté');
});

/**
 * Call this on app init (layout) to auto-connect if we have a saved session.
 */
export function autoReconnect(): void {
	const state = get(game);
	if (state.roomCode && state.myPseudo && !get(isConnected)) {
		socket.connect();
	}
}
