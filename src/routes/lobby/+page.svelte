<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fade, scale, slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	
	import { socket, isConnected } from '$lib/stores/socket';
	import { game } from '$lib/stores/gameState';
    import type { Player } from '$lib/type';   

	let copied = false;
	let playerCount = 0;

	onMount(() => {
        // 1. GESTION DE L'ÉTAT INITIAL
        const urlRoom = $page.url.searchParams.get('room');
        const urlName = $page.url.searchParams.get('name');

        // Cas A : Rechargement de page (F5) -> Le store est vide, on utilise l'URL
        if (!$game.roomCode && urlRoom) {
            // On restaure les données dans le store
            game.update(g => ({ ...g, roomCode: urlRoom || '', myPseudo: urlName || '' }));
            
            // On force la reconnexion au socket si besoin
            if (!$isConnected) socket.connect();
            
            // On rejoint la salle (Le backend renverra roomData après le join)
            socket.emit('joinRoom', { roomId: urlRoom, name: urlName });
        } 
        // Cas B : Navigation normale depuis l'accueil -> Le store contient déjà le code
        else if ($game.roomCode) {
            socket.emit('requestRoomData', { roomId: $game.roomCode });
        } 
        else {
            goto('/');
        }

        // 2. ÉCOUTE DES ÉVÉNEMENTS
        socket.on('roomData', (data: { roomId: string, players: Player[], creatorSocketId: string }) => {
            // On met à jour la liste des joueurs et on détermine qui est le créateur
            game.update(g => ({
                ...g,
                players: data.players.map(p => ({ ...p, isCreator: p.socketId === data.creatorSocketId })),
                isCreator: socket.id === data.creatorSocketId // Est-ce que c'est MOI le chef ?
            }));
            playerCount = data.players.length;
        });

        socket.on('gameStarted', () => {
            goto('/game');
        });
    });

	onDestroy(() => {
		socket.off('roomData');
		socket.off('gameStarted');
	});

	// Actions
	function startGame() {
		socket.emit('startGame', { roomId: $game.roomCode });
	}

	function leaveGame() {
		socket.disconnect(); // Couper proprement
		game.set({ ...$game, roomCode: '', players: [] }); // Reset store
		goto('/');
		// Petit hack : recharger la page pour clean le socket state complet si besoin
		setTimeout(() => location.reload(), 50); 
	}

	async function copyLink() {
        const url = `${window.location.origin}/?code=${$game.roomCode}`; 
        
        try {
            await navigator.clipboard.writeText(url);
            copied = true;
            setTimeout(() => copied = false, 2000);
        } catch (err) {
            console.error('Erreur copie', err);
        }
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-brand-dark to-slate-900 text-white p-6 relative overflow-hidden flex flex-col">

	<header class="w-full max-w-4xl mx-auto flex justify-center items-center mb-8 z-10">
		<!-- <div>
			<h1 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
				Mnemosyne
			</h1>
		</div> -->
		<div class="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3">
			<span class="text-slate-300 text-sm uppercase tracking-wider">Salon</span>
			<span class="text-xl font-mono font-bold text-brand-primary">{$game.roomCode}</span>
			<button 
				on:click={copyLink}
				class="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"
			>
				{copied ? 'Copié !' : 'Copier'}
			</button>
		</div>
	</header>

	<main class="flex-grow flex flex-col items-center justify-center w-full max-w-4xl mx-auto z-10">
		
		<h2 class="text-3xl font-bold mb-8 text-center">
			En attente des joueurs <span class="animate-pulse">...</span>
			<br>
			<span class="text-lg font-normal text-slate-400">({$game.players.length} connecté{#if $game.players.length > 1}s{/if})</span>
		</h2>

		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
			{#each $game.players as player (player.socketId)}
                <div 
                    animate:flip={{duration: 300}}
                    in:scale={{duration: 300, start: 0.8}}
                    class="relative group"
                >
                    <div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-between gap-3 hover:bg-slate-800 transition-colors h-full">
                        
                        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-2xl font-bold shadow-lg shadow-brand-primary/20">
                            {player.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        <div class="text-center w-full">
                            <p class="font-bold truncate w-full px-2">{player.name}</p>
                            
                            <div class="flex flex-col items-center min-h-[1.5rem]">
                                {#if player.isCreator}
                                    <span class="text-xs text-yellow-400 font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20 mt-1">👑 VIP</span>
                                {/if}
                                {#if player.name === $game.myPseudo}
                                    <span class="text-xs text-slate-400 block mt-1">(Toi)</span>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
			
			{#if $game.players.length < 4}
				{#each Array(4 - $game.players.length) as _}
					<div class="border-2 border-dashed border-slate-700/50 rounded-xl p-4 flex items-center justify-center opacity-30">
						<span class="text-slate-500 text-sm">Emplacement libre</span>
					</div>
				{/each}
			{/if}
		</div>

	</main>

	<footer class="w-full max-w-md mx-auto z-10 mt-8 space-y-3">
		{#if $game.isCreator}
			<button 
				in:slide
				on:click={startGame}
				class="w-full py-4 rounded-xl font-bold text-xl bg-gradient-to-r from-brand-primary to-indigo-600 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/30 text-white"
			>
				Lancer la partie 🚀
			</button>
		{:else}
			<div in:fade class="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-slate-300">
				L'hôte va lancer la partie bientôt...
			</div>
		{/if}

		<button 
			on:click={leaveGame}
			class="w-full py-3 rounded-xl font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
		>
			Quitter le salon
		</button>
	</footer>

	<div class="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
	<div class="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-secondary/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style="animation-delay: 2s;"></div>

</div>