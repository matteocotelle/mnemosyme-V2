<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import { fly, scale, fade } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    
    import { socket } from '$lib/stores/socket';
    import { game } from '$lib/stores/gameState';

    let currentQuestion: any = null;
    let userAnswer = '';
    let isSubmitted = false;
    let timerProgress = 100;
    let timeLeft = 20;
    let timerInterval: any;

    onMount(() => {
        if (!$game.roomCode) {
            goto('/');
            return;
        }

        socket.on('newQuestion', (q) => {
            // FIX "RÉPONSE VIDE" : 
            // Si une nouvelle question arrive et qu'on a tapé quelque chose mais pas envoyé...
            // On force l'envoi immédiat pour la question PRÉCÉDENTE !
            if (currentQuestion && !isSubmitted && userAnswer.trim() !== '') {
                // On utilise false pour ne pas flouter le clavier, et on passe l'index de l'ANCIENNE question
                submitAnswer(false, currentQuestion.index);
            }

            currentQuestion = q;
            userAnswer = '';
            isSubmitted = false;
            startTimer(q.seconds);
        });

        socket.on('gameFinished', () => {
            goto('/correction');
        });
    });

    onDestroy(() => {
        if (timerInterval) clearInterval(timerInterval);
        socket.off('newQuestion');
        socket.off('gameFinished');
    });

    function startTimer(seconds: number) {
        timeLeft = seconds;
        timerProgress = 100;
        if (timerInterval) clearInterval(timerInterval);

        const step = 100 / (seconds * 10);
        
        timerInterval = setInterval(() => {
            timeLeft -= 0.1;
            timerProgress -= step;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (!isSubmitted) submitAnswer(true);
            }
        }, 100);
    }

    function submitAnswer(auto = false, forcedIndex?: number) {
        if (isSubmitted && forcedIndex === undefined) return; // Sécurité
        isSubmitted = true;
        
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
		
		console.log("📤 FRONT ENVOIE :", {
            answer: userAnswer,
            indexEnvoye: currentQuestion.index // On vérifie que c'est le bon index
        });

        // On détermine quel index envoyer : celui forcé (l'ancien) ou l'actuel
        const indexToSend = (forcedIndex !== undefined) ? forcedIndex : currentQuestion.index;

        socket.emit('submitAnswer', {
            roomId: $game.roomCode,
            answer: userAnswer,
            questionIndex: indexToSend 
        });
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-brand-dark to-slate-900 text-white flex flex-col relative overflow-hidden">

    <div class="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-white/10 shadow-lg">
        <header class="w-full p-4 flex justify-between items-center">
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span class="font-mono font-bold text-brand-primary text-sm md:text-base">EN DIRECT</span>
            </div>
            <div class="font-bold text-lg md:text-xl">
                {#if currentQuestion}
                    Question {currentQuestion.index + 1} <span class="text-slate-500 text-sm">/ {currentQuestion.total}</span>
                {:else}
                    Prêt ?
                {/if}
            </div>
            <div class="bg-slate-800 px-3 py-1 rounded-lg text-sm border border-slate-700 truncate max-w-[100px]">
                {$game.myPseudo.length > 5 
					? $game.myPseudo.slice(0, 5)
					: $game.myPseudo}
            </div>
        </header>

        <div class="w-full h-2 bg-slate-800 relative">
            <div 
                class="h-full transition-all duration-100 ease-linear"
                style="width: {timerProgress}%; background-color: {timerProgress < 30 ? '#ef4444' : '#6366f1'};"
            ></div>
        </div>
    </div>

    <main class="flex-grow flex flex-col items-center justify-start pt-32 p-6 w-full max-w-4xl mx-auto z-10 overflow-x-hidden">
        
        {#if currentQuestion}
            <div class="grid grid-cols-1 grid-rows-1 w-full">
                {#key currentQuestion.index} 
                    <div 
                        in:fly={{ x: 200, duration: 500, opacity: 0, easing: quintOut }}
                        class="w-full flex flex-col items-center gap-6 md:gap-8 col-start-1 row-start-1"
                    >
                        <h1 class="text-2xl md:text-5xl font-extrabold text-center leading-tight drop-shadow-lg break-words w-full">
                            {currentQuestion.text}
                        </h1>

                        {#if currentQuestion.image}
                            <div class="relative group w-full max-w-xs md:max-w-md">
                                <div class="absolute -inset-1 bg-gradient-to-r from-brand-primary to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                                <img 
                                    src={currentQuestion.image} 
                                    alt="Question" 
                                    class="relative w-full rounded-xl shadow-2xl object-cover border-2 border-slate-700"
                                />
                            </div>
                        {/if}

                        <div class="w-full max-w-lg relative mt-4 md:mt-8 pb-10">
                            {#if !isSubmitted}
                                <div class="relative">
                                    <!-- svelte-ignore a11y_autofocus -->
                                    <input 
                                        type="text" 
                                        bind:value={userAnswer}
                                        on:keydown={(e) => e.key === 'Enter' && submitAnswer()} 
                                        placeholder="Tape ta réponse..."
                                        autofocus
                                        class="w-full bg-slate-800/80 border-2 border-slate-600 text-white text-center text-xl md:text-2xl font-bold rounded-2xl py-4 md:py-6 px-4 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20 outline-none transition-all shadow-xl placeholder-slate-600"
                                    />
                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm animate-pulse hidden md:block">
                                        ⏳
                                    </div>
                                </div>
                                <p class="text-slate-400 text-xs text-center mt-3">
                                    La réponse sera envoyée à la fin du chrono
                                </p>
                            {:else}
                                <div in:scale class="w-full bg-slate-800/50 border border-brand-primary/50 text-brand-primary text-center text-xl font-bold rounded-2xl py-6 px-4">
                                    <span class="animate-pulse">Réponse verrouillée 🔒</span>
                                </div>
                            {/if}
                        </div>

                    </div>
                {/key}
            </div>
        {:else}
            <div class="text-center animate-pulse mt-20">
                <h2 class="text-4xl font-bold mb-4">Préparez-vous...</h2>
                <p class="text-slate-400">Le jeu va commencer !</p>
            </div>
        {/if}

    </main>

    <div class="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary rounded-full mix-blend-screen filter blur-[128px] animate-float"></div>
        <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600 rounded-full mix-blend-screen filter blur-[128px] animate-float" style="animation-delay: 2s;"></div>
    </div>

</div>