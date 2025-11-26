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
	let timerProgress = 100; // Pour la barre (0 à 100%)
	let timeLeft = 20;
	let timerInterval: any;

	onMount(() => {
		// Redirection si pas connecté (F5 sauvage)
		if (!$game.roomCode) {
			goto('/');
			return;
		}

		socket.on('newQuestion', (q) => {
			currentQuestion = q;
			userAnswer = '';
			isSubmitted = false;
			startTimer(q.seconds);
		});

		socket.on('gameFinished', () => {
			goto('/correction'); // On créera cette page ensuite
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

		const step = 100 / (seconds * 10); // Mise à jour toutes les 100ms
		
		timerInterval = setInterval(() => {
			timeLeft -= 0.1;
			timerProgress -= step;
			
			if (timeLeft <= 0) {
				clearInterval(timerInterval);
				if (!isSubmitted) submitAnswer(true); // Auto-submit si temps écoulé
			}
		}, 100);
	}

	function submitAnswer(auto = false) {
		if (isSubmitted) return;
		isSubmitted = true;
		
		// ASTUCE MOBILE : On ferme le clavier virtuel proprement
		if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}

		socket.emit('submitAnswer', {
			roomId: $game.roomCode,
			answer: userAnswer
		});
	}
    
    // Fonction helper pour récupérer l'URL de l'image (via ton backend existant ou nouveau)
    // Si tu as gardé ton endpoint express /api/image-url, tu peux l'appeler ici
    // Sinon, on affiche l'image direct si c'est une URL publique
</script>

<div class="min-h-screen bg-gradient-to-br from-brand-dark to-slate-900 text-white flex flex-col relative overflow-hidden">

	<header class="w-full p-4 flex justify-between items-center z-10 bg-slate-900/50 backdrop-blur-sm border-b border-white/10">
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
			<span class="font-mono font-bold text-brand-primary">EN DIRECT</span>
		</div>
		<div class="font-bold text-xl">
			{#if currentQuestion}
				Question {currentQuestion.index + 1} <span class="text-slate-500 text-sm">/ {currentQuestion.total}</span>
			{:else}
				Prêt ?
			{/if}
		</div>
		<div class="bg-slate-800 px-3 py-1 rounded-lg text-sm border border-slate-700">
			{$game.myPseudo}
		</div>
	</header>

	<div class="w-full h-2 bg-slate-800 relative z-20">
		<div 
			class="h-full transition-all duration-100 ease-linear"
			style="width: {timerProgress}%; background-color: {timerProgress < 30 ? '#ef4444' : '#6366f1'};"
		></div>
	</div>

	<main class="flex-grow flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto z-10">
		
		{#if currentQuestion}
			{#key currentQuestion.index} <div 
					in:fly={{ x: 200, duration: 500, opacity: 0, easing: quintOut }}
					class="w-full flex flex-col items-center gap-8"
				>
					
					<h1 class="text-3xl md:text-5xl font-extrabold text-center leading-tight drop-shadow-lg">
						{currentQuestion.text}
					</h1>

					{#if currentQuestion.image}
						<div class="relative group">
							<div class="absolute -inset-1 bg-gradient-to-r from-brand-primary to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
							<img 
								src={currentQuestion.image} 
								alt="Question" 
								class="relative rounded-xl shadow-2xl max-h-64 object-cover border-2 border-slate-700"
							/>
                            </div>
					{/if}

					<div class="w-full max-w-lg relative mt-8">
						{#if !isSubmitted}
							<div class="relative">
								<!-- svelte-ignore a11y_autofocus -->
								<input 
									type="text" 
									bind:value={userAnswer}
									on:keydown={(e) => e.key === 'Enter' && submitAnswer()} 
									placeholder="Tape ta réponse ici..."
									autofocus
									class="w-full bg-slate-800/80 border-2 border-slate-600 text-white text-center text-2xl font-bold rounded-2xl py-6 px-4 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20 outline-none transition-all shadow-xl placeholder-slate-600"
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
		{:else}
			<div class="text-center animate-pulse">
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