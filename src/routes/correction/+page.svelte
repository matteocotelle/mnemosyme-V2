<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import { slide, scale, fade } from 'svelte/transition';
    
    import { socket } from '$lib/stores/socket';
    import { game } from '$lib/stores/gameState';
    import type { Player } from '$lib/type'; // Assure-toi que le chemin est bon (types ou type)

    let state: any = null; // Contient { question, players, ... }

    // Variable réactive : Vérifie si TOUS les joueurs ont une correction (true ou false)
    // On ignore ceux qui sont undefined ou null
    $: allValidated = state?.players.every((p: any) => p.isCorrect === true || p.isCorrect === false) ?? false;

    onMount(() => {
        if (!$game.roomCode) { goto('/'); return; }

        // Demander l'état initial
        socket.emit('requestCorrectionData', { roomId: $game.roomCode });

        socket.on('correctionState', (data) => {
            state = data;
        });

        socket.on('correctionFinished', (data: { leaderboard: Player[] }) => {
            game.update(g => ({ ...g, leaderboard: data.leaderboard }));
            goto('/result'); 
        });
    });

    onDestroy(() => {
        socket.off('correctionState');
        socket.off('correctionFinished');
    });

    // Action Créateur : Valider/Invalider
    function togglePlayer(targetSocketId: string) {
        if (!$game.isCreator) return; 
        socket.emit('toggleValidation', { 
            roomId: $game.roomCode, 
            targetSocketId 
        });
    }

    // Action Créateur : Suivante
    function nextQuestion() {
        if (!$game.isCreator) return;
        if (!allValidated) return; // Sécurité supplémentaire
        socket.emit('nextCorrection', { roomId: $game.roomCode });
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-900 to-brand-dark text-white p-4 pb-24">
    
    <header class="text-center mb-6">
        <h1 class="text-brand-primary font-bold tracking-widest text-sm uppercase mb-2">Correction</h1>
        {#if state}
            <h2 class="text-2xl font-bold">Question {state.questionIndex + 1} <span class="text-slate-500">/ {state.total}</span></h2>
        {:else}
            <p class="animate-pulse">Chargement...</p>
        {/if}
    </header>

    {#if state}
        <div class="max-w-2xl mx-auto space-y-8" in:fade>
            
            <div class="relative bg-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-xl backdrop-blur-sm">
                
                <div class="absolute top-4 right-4 bg-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-500/30">
                    {state.question.points} Pts
                </div>

                <h3 class="text-xl font-medium mb-4 mt-2">{state.question.text}</h3>
                
                {#if state.question.image}
                    <img src={state.question.image} alt="Question" class="mx-auto h-40 rounded-lg mb-4 object-cover"/>
                {/if}

                <div class="bg-green-500/20 border border-green-500/50 rounded-xl p-3 inline-block">
                    <span class="text-green-400 text-sm uppercase font-bold block mb-1">Bonne réponse</span>
                    <span class="text-white font-bold text-lg">{state.question.answer}</span>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-3">
                {#each state.players as player (player.socketId)}
                    <button 
                        disabled={!$game.isCreator}
                        on:click={() => togglePlayer(player.socketId)}
                        class="relative w-full text-left group transition-all duration-200 active:scale-95"
                    >
                        <div class="
                            flex items-center justify-between p-4 rounded-xl border-2 shadow-lg transition-colors
                            {player.isCorrect === true ? 'bg-green-900/40 border-green-500' : 
                             player.isCorrect === false ? 'bg-red-900/40 border-red-500' : 
                             'bg-slate-800 border-slate-700'}
                        ">
                            <div class="flex-grow">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-bold text-slate-200">{player.name}</span>
                                    {#if player.socketId === $game.creatorSocketId}
                                        <span class="text-xs bg-yellow-500/20 text-yellow-500 px-1 rounded">Hôte</span>
                                    {/if}
                                </div>
                                <p class="text-lg font-medium text-white truncate pr-2">
                                    {player.answer}
                                </p>
                            </div>

                            <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-black/20">
                                {#if player.isCorrect === true}
                                    <span class="text-2xl" in:scale>✅</span>
                                {:else if player.isCorrect === false}
                                    <span class="text-2xl" in:scale>❌</span>
                                {:else}
                                    <span class="text-slate-500 text-xl">?</span>
                                {/if}
                            </div>
                        </div>
                        
                        {#if $game.isCreator}
                            <div class="absolute inset-0 rounded-xl ring-2 ring-white/0 group-hover:ring-white/20 transition-all pointer-events-none"></div>
                        {/if}
                    </button>
                {/each}
            </div>

        </div>
    {/if}

    {#if $game.isCreator}
        <div class="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-md border-t border-white/10 z-20">
            <div class="max-w-2xl mx-auto">
                <button 
                    on:click={nextQuestion}
                    disabled={!allValidated}
                    class="w-full font-bold text-xl py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2
                    {!allValidated 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600' 
                        : 'bg-brand-primary hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 active:scale-95'}"
                >
                    {#if !allValidated}
                        <span>Corrigez tout le monde d'abord</span>
                    {:else}
                        <span>Valider & Suivant ➔</span>
                    {/if}
                </button>
            </div>
        </div>
    {:else}
        <div class="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-md border-t border-white/10 z-20 text-center text-slate-400">
            En attente du correcteur...
        </div>
    {/if}
</div>