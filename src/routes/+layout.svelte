<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.png';
	import MuteButton from '$lib/components/MuteButton.svelte';
	import { autoReconnect, socket } from '$lib/stores/socket';
	import { game } from '$lib/stores/gameState';

	let { children } = $props();

	onMount(() => {
		// Auto-reconnect if we have a saved session (page refresh)
		autoReconnect();

		// Handle reconnection state from backend
		socket.on('reconnectionState', (snapshot) => {
			// Update game store with room data
			if (snapshot.roomData) {
				game.update((g) => ({
					...g,
					players: snapshot.roomData.players.map((p: any) => ({
						...p,
						isCreator: p.socketId === snapshot.roomData.creatorSocketId,
					})),
					isCreator: socket.id === snapshot.roomData.creatorSocketId,
					settings: snapshot.roomData.settings || g.settings,
				}));
			}

			// Store reconnection data for the target page to pick up
			if (typeof window !== 'undefined') {
				(window as any).__reconnectionSnapshot = snapshot;
			}

			// Navigate to the correct page based on current phase
			switch (snapshot.phase) {
				case 'lobby':
					goto('/lobby');
					break;
				case 'playing':
					goto('/game');
					break;
				case 'correction':
					goto('/correction');
					break;
				case 'result':
					if (snapshot.leaderboard) {
						game.update((g) => ({
							...g,
							leaderboard: snapshot.leaderboard,
							stats: snapshot.stats,
						}));
					}
					goto('/result');
					break;
			}
		});

		return () => {
			socket.off('reconnectionState');
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Mnemosyne</title>
</svelte:head>

<MuteButton />
{@render children()}
