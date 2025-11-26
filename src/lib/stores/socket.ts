// src/lib/stores/socket.ts
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client'; // Note le "import type" explicite
import { writable } from 'svelte/store';
import { PUBLIC_BACKEND_URL } from '$env/static/public';

// On exporte isConnected pour l'utiliser dans l'interface
export const isConnected = writable<boolean>(false);

const URL = PUBLIC_BACKEND_URL || 'http://localhost:3000';

// On type la variable socket. 
// "io(...)" renvoie un objet qui correspond à l'interface Socket
export const socket: Socket = io(URL, {
    autoConnect: false
});

socket.on('connect', () => {
    isConnected.set(true);
    console.log('✅ Socket connecté');
});

socket.on('disconnect', () => {
    isConnected.set(false);
    console.log('🔴 Socket déconnecté');
});