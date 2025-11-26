<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fly, scale, fade } from 'svelte/transition';
    import { elasticOut, backOut } from 'svelte/easing';
    import confetti from 'canvas-confetti';

    import { socket } from '$lib/stores/socket';
    import { game } from '$lib/stores/gameState';
    import type { Player } from '$lib/type'; // Vérifie le chemin (types ou type)

    let winners: Player[] = [];   // Top 3 pour le podium
    let allPlayers: Player[] = []; // Tout le monde pour la liste
    
    // États pour l'animation séquentielle
    let showThird = false;
    let showSecond = false;
    let showFirst = false;
    let showList = false; // Affiche le tableau complet

    onMount(() => {
        if (!$game.roomCode || !$game.leaderboard) {
            goto('/');
            return;
        }

        // 1. TRI ROBUSTE (Score décroissant, puis Nom croissant)
        const sorted = [...$game.leaderboard].sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score; // Le plus gros score d'abord
            }
            return a.name.localeCompare(b.name); // Si égalité, ordre alphabétique
        });

        // 2. DISTRIBUTION
        winners = sorted.slice(0, 3); // Pour le podium
        allPlayers = sorted;          // Pour la liste complète

        // 3. SÉQUENCE D'ANIMATION (Podium d'abord)
        setTimeout(() => showThird = true, 500);
        setTimeout(() => showSecond = true, 1500);
        setTimeout(() => {
            showFirst = true;
            launchConfetti();
        }, 2500);

        // 4. APPARITION DE LA LISTE COMPLÈTE (Après le podium)
        setTimeout(() => showList = true, 3500); 

        // Écoute pour rejouer
        socket.on('gameRestarted', () => {
            game.update(g => ({ ...g, status: 'lobby', score: 0 }));
            goto('/lobby');
        });
    });

    function restartGame() {
        socket.emit('restartGame', { roomId: $game.roomCode });
    }

    function launchConfetti() {
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#6366f1', '#ec4899', '#fbbf24']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#6366f1', '#ec4899', '#fbbf24']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-brand-dark to-slate-900 text-white p-4 flex flex-col items-center overflow-x-hidden">

    <header class="text-center mt-6 mb-8 z-10">
        <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-sm">
            CLASSEMENT FINAL
        </h1>
        <p class="text-slate-400 mt-2">Le grand vainqueur est...</p>
    </header>

    <main class="flex-grow w-full max-w-4xl flex flex-col items-center relative z-10">
        
        <div class="flex flex-col-reverse md:flex-row items-end justify-center gap-4 md:gap-8 w-full mb-12 min-h-[300px]">
            
            {#if winners[1] && showSecond}
                <div 
                    in:fly={{ y: 200, duration: 800, easing: backOut }}
                    class="flex flex-col items-center w-full md:w-1/3 order-2 md:order-1"
                >
                    <div class="mb-2 text-center">
                        <div class="text-2xl font-bold">{winners[1].name}</div>
                        <div class="text-slate-400">{winners[1].score} pts</div>
                    </div>
                    <div class="w-full bg-slate-700 h-32 md:h-48 rounded-t-xl flex items-start justify-center pt-4 shadow-xl border-t-4 border-slate-400 relative">
                        <span class="text-5xl font-bold text-slate-500/50">2</span>
                        <div class="absolute -top-10 w-20 h-20 rounded-full bg-slate-400 border-4 border-slate-800 flex items-center justify-center text-2xl font-bold shadow-lg">
                            {winners[1].name.substring(0,2).toUpperCase()}
                        </div>
                    </div>
                </div>
            {/if}

            {#if winners[0] && showFirst}
                <div 
                    in:fly={{ y: 300, duration: 800, easing: elasticOut }}
                    class="flex flex-col items-center w-full md:w-1/3 order-3 md:order-2 z-20"
                >
                    <div class="text-6xl mb-4 animate-bounce">👑</div>
                    
                    <div class="mb-2 text-center">
                        <div class="text-3xl font-extrabold text-yellow-400">{winners[0].name}</div>
                        <div class="text-yellow-200 font-bold text-xl">{winners[0].score} pts</div>
                    </div>
                    
                    <div class="w-full bg-gradient-to-b from-yellow-500 to-yellow-700 h-40 md:h-64 rounded-t-2xl flex items-start justify-center pt-6 shadow-2xl shadow-yellow-500/20 border-t-4 border-yellow-300 relative">
                        <span class="text-7xl font-bold text-yellow-900/30">1</span>
                        <div class="absolute -top-12 w-24 h-24 rounded-full bg-yellow-400 border-4 border-slate-900 flex items-center justify-center text-3xl font-bold shadow-xl shadow-yellow-500/50">
                            {winners[0].name.substring(0,2).toUpperCase()}
                        </div>
                    </div>
                </div>
            {/if}

            {#if winners[2] && showThird}
                <div 
                    in:fly={{ y: 200, duration: 800, easing: backOut }}
                    class="flex flex-col items-center w-full md:w-1/3 order-1 md:order-3"
                >
                    <div class="mb-2 text-center">
                        <div class="text-2xl font-bold">{winners[2].name}</div>
                        <div class="text-slate-400">{winners[2].score} pts</div>
                    </div>
                    <div class="w-full bg-amber-800 h-24 md:h-36 rounded-t-xl flex items-start justify-center pt-4 shadow-xl border-t-4 border-amber-600 relative">
                        <span class="text-5xl font-bold text-amber-900/50">3</span>
                        <div class="absolute -top-10 w-20 h-20 rounded-full bg-amber-700 border-4 border-slate-800 flex items-center justify-center text-2xl font-bold shadow-lg">
                            {winners[2].name.substring(0,2).toUpperCase()}
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        {#if showList && allPlayers.length > 0}
            <div class="w-full max-w-md space-y-2 mb-32">
                <h3 class="text-center text-slate-500 text-sm uppercase mb-4" in:fade>Tableau Complet</h3>
                
                {#each allPlayers as player, i}
                    <div 
                        in:fly={{ 
                            x: -100, // Arrive depuis la gauche
                            duration: 400, // Durée du mouvement
                            delay: (allPlayers.length - 1 - i) * 50 // Apparition en cascade inversée (très rapide: 50ms)
                        }}
                        class="flex items-center justify-between p-4 rounded-xl border border-white/5 
                        {i === 0 ? 'bg-yellow-500/20 border-yellow-500/50' : 
                         i === 1 ? 'bg-slate-500/20 border-slate-400/30' : 
                         i === 2 ? 'bg-amber-700/20 border-amber-600/30' : 
                         'bg-slate-800/50 border-slate-700'}"
                    >
                        <div class="flex items-center gap-4">
                            <span class="font-mono font-bold w-6 text-right
                                {i === 0 ? 'text-yellow-400' : 
                                 i === 1 ? 'text-slate-300' : 
                                 i === 2 ? 'text-amber-500' : 
                                 'text-slate-500'}">
                                #{i + 1}
                            </span>
                            
                            <span class="font-bold truncate max-w-[150px]">{player.name}</span>
                            
                            {#if player.socketId === $game.creatorSocketId}
                                <span class="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">Hôte</span>
                            {/if}
                        </div>

                        <span class="font-bold text-lg 
                            {i === 0 ? 'text-yellow-400' : 'text-slate-400'}">
                            {player.score} pts
                        </span>
                    </div>
                {/each}
            </div>
        {/if}

    </main>

    <div class="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-md border-t border-white/10 z-30">
        <div class="max-w-md mx-auto space-y-3">
            {#if $game.isCreator}
                <button 
                    on:click={restartGame}
                    class="w-full bg-gradient-to-r from-brand-primary to-indigo-500 text-white font-bold text-xl py-4 rounded-xl shadow-lg active:scale-95 transition-all"
                >
                    🔄 Rejouer (Même Salon)
                </button>
            {:else}
                <div class="text-center text-slate-400 py-2">
                    En attente de l'animateur...
                </div>
            {/if}
            
            <button 
                on:click={() => goto('/')}
                class="w-full text-slate-400 hover:text-white py-2 text-sm font-medium"
            >
                Quitter et retourner à l'accueil
            </button>
        </div>
    </div>

    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
    </div>

</div>