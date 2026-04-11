<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly, scale, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	import { socket } from '$lib/stores/socket';
	import { game, resetGame } from '$lib/stores/gameState';
	import { playSound } from '$lib/stores/sound';
	import { Broadcast, Lock, PaintBrush, Lightning } from 'phosphor-svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';

	let currentQuestion: any = null;
	let userAnswer = '';
	let isSubmitted = false;
	let drawingCanvas: DrawingCanvas;
	let timerProgress = 100;
	let timeLeft = 20;
	let timerInterval: any;
	let lastTickPlayed = 0;
	let totalSeconds = 20;

	onMount(() => {
		if (!$game.roomCode || !$game.myPseudo) {
			resetGame();
			goto('/');
			return;
		}

		// Check for reconnection snapshot (from layout after page refresh)
		const snapshot = typeof window !== 'undefined' && (window as any).__reconnectionSnapshot;
		if (snapshot?.phase === 'playing' && snapshot.currentQuestion) {
			currentQuestion = snapshot.currentQuestion;
			totalSeconds = snapshot.currentQuestion.seconds;
			const remaining = (snapshot.remainingMs || 0) / 1000;
			startTimer(remaining);
			delete (window as any).__reconnectionSnapshot;
		}

		socket.on('newQuestion', (q) => {
			if (currentQuestion && !isSubmitted && userAnswer.trim() !== '') {
				submitAnswer(false, currentQuestion.index);
			}

			currentQuestion = q;
			userAnswer = '';
			isSubmitted = false;
			lastTickPlayed = 0;
			totalSeconds = q.seconds;
			playSound('whoosh', 0.4);
			startTimer(q.seconds);

			// Prefetch next question's image
			if (q.nextImage) {
				const img = new Image();
				img.src = q.nextImage;
			}
		});

		// Timer sync from server (anti-cheat + drift correction)
		socket.on('timerSync', (data: { remainingMs: number; questionIndex: number }) => {
			if (!currentQuestion || data.questionIndex !== currentQuestion.index) return;

			const serverTimeLeft = data.remainingMs / 1000;
			// Only correct if drift is significant (> 1s)
			if (Math.abs(serverTimeLeft - timeLeft) > 1) {
				timeLeft = serverTimeLeft;
				timerProgress = (timeLeft / totalSeconds) * 100;
			}
		});

		// Reconnection state
		socket.on('reconnectionState', (snapshot: any) => {
			if (snapshot.phase === 'playing' && snapshot.currentQuestion) {
				currentQuestion = snapshot.currentQuestion;
				totalSeconds = snapshot.currentQuestion.seconds;
				const remaining = (snapshot.remainingMs || 0) / 1000;
				startTimer(remaining);
			} else if (snapshot.phase === 'correction') {
				goto('/correction');
			} else if (snapshot.phase === 'result') {
				if (snapshot.leaderboard) {
					game.update((g) => ({
						...g,
						leaderboard: snapshot.leaderboard,
						stats: snapshot.stats
					}));
				}
				goto('/result');
			}
		});

		socket.on('gameFinished', () => {
			goto('/correction');
		});
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
		socket.off('newQuestion');
		socket.off('gameFinished');
		socket.off('timerSync');
		socket.off('reconnectionState');
	});

	function startTimer(seconds: number) {
		timeLeft = seconds;
		timerProgress = (seconds / totalSeconds) * 100;
		if (timerInterval) clearInterval(timerInterval);

		timerInterval = setInterval(() => {
			timeLeft -= 0.1;
			timerProgress = (timeLeft / totalSeconds) * 100;

			const rounded = Math.ceil(timeLeft);
			if (rounded <= 5 && rounded > 0 && rounded !== lastTickPlayed) {
				lastTickPlayed = rounded;
				if (rounded <= 3) {
					playSound('timer-urgent', 0.3);
					navigator?.vibrate?.(100);
				} else {
					playSound('timer', 0.2);
					navigator?.vibrate?.(50);
				}
			}

			if (timeLeft <= 0) {
				clearInterval(timerInterval);
				timerProgress = 0;
				if (!isSubmitted) submitAnswer(true);
			}
		}, 100);
	}

	function submitOpinion(choice: string) {
		if (isSubmitted) return;
		userAnswer = choice;
		submitAnswer();
	}

	function submitAnswer(auto = false, forcedIndex?: number) {
		if (isSubmitted && forcedIndex === undefined) return;
		isSubmitted = true;

		if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}

		playSound('send', 0.4);

		const indexToSend = forcedIndex !== undefined ? forcedIndex : currentQuestion.index;

		// For drawing questions, capture canvas data
		let answer = userAnswer;
		if (currentQuestion?.type === 'drawing' && drawingCanvas && forcedIndex === undefined) {
			answer = drawingCanvas.getDataUrl();
		}

		socket.emit('submitAnswer', {
			roomId: $game.roomCode,
			answer,
			questionIndex: indexToSend
		});
	}

	$: isTriple = currentQuestion?.isTriple ?? false;
	$: timerColor = isTriple ? 'bg-secondary' : timerProgress < 30 ? 'bg-error' : 'bg-primary';
	$: timerFlash = timeLeft <= 5 && timeLeft > 0;
</script>

<div class="min-h-dvh flex flex-col">
	<!-- Fixed header -->
	<div class="fixed top-0 left-0 right-0 z-40 bg-background/95 border-b border-white/5">
		<header class="w-full px-4 py-3 flex justify-between items-center">
			<div class="flex items-center gap-2">
				<div class="w-2.5 h-2.5 rounded-full bg-error animate-pulse-dot"></div>
				<span class="font-heading font-semibold text-primary text-sm">EN DIRECT</span>
			</div>
			<div class="font-heading font-bold text-base">
				{#if currentQuestion}
					<Broadcast size={16} weight="bold" class="inline text-accent mr-1" />
					{currentQuestion.index + 1}
					<span class="text-text-muted text-sm font-normal">/ {currentQuestion.total}</span>
				{:else}
					<span class="text-text-muted">Prêt ?</span>
				{/if}
			</div>
			<div class="bg-surface px-3 py-1 rounded-lg text-sm text-text-muted truncate max-w-[100px]">
				{$game.myPseudo}
			</div>
		</header>

		<!-- Timer bar -->
		<div class="w-full h-1.5 bg-surface">
			<div
				class="h-full transition-all duration-100 ease-linear {timerColor}"
				class:animate-pulse={timerFlash}
				style="width: {Math.max(0, timerProgress)}%;"
			></div>
		</div>
	</div>

	<!-- Main content -->
	<main class="flex-grow flex flex-col items-center justify-start pt-24 px-5 pb-6 w-full max-w-2xl mx-auto">
		{#if currentQuestion}
			<div class="grid grid-cols-1 grid-rows-1 w-full">
				{#key currentQuestion.index}
					<div
						in:fly={{ x: 100, duration: 400, opacity: 0, easing: quintOut }}
						class="w-full flex flex-col items-center gap-5 col-start-1 row-start-1"
					>
						{#if isTriple}
							<div
								in:scale={{ duration: 300 }}
								class="inline-flex items-center gap-1.5 bg-secondary/15 text-secondary font-heading font-bold text-sm px-3 py-1.5 rounded-xl border border-secondary/30 animate-pulse"
							>
								<Lightning size={16} weight="fill" />
								POINTS x3
							</div>
						{/if}

						<h1 class="text-2xl md:text-4xl font-heading font-bold text-center leading-tight break-words w-full {isTriple ? 'text-secondary' : ''}">
							{currentQuestion.text}
						</h1>

						{#if currentQuestion.image}
							<div class="w-full max-w-xs md:max-w-md">
								<img
									src={currentQuestion.image}
									alt="Question"
									class="w-full rounded-2xl shadow-lg object-cover border border-white/5"
								/>
							</div>
						{/if}

						<div class="w-full max-w-lg mt-4 pb-6">
							{#if currentQuestion.type === 'drawing'}
								<!-- Drawing: canvas -->
								{#if !isSubmitted}
									<p class="text-accent text-xs text-center mb-3 font-medium uppercase tracking-wider flex items-center justify-center gap-1">
										<PaintBrush size={14} weight="bold" />
										Dessine ta réponse !
									</p>
									<DrawingCanvas bind:this={drawingCanvas} disabled={isSubmitted} />
								{:else}
									<div
										in:scale={{ duration: 200 }}
										class="w-full card border-accent/30 text-accent text-center text-lg font-heading font-semibold py-5 px-4 flex items-center justify-center gap-2"
									>
										<Lock size={20} weight="bold" />
										Dessin envoyé
									</div>
								{/if}
							{:else if currentQuestion.type === 'opinion' && currentQuestion.choices}
								<!-- Opinion: two choice buttons -->
								{#if !isSubmitted}
									<p class="text-accent text-xs text-center mb-3 font-medium uppercase tracking-wider">
										La majorité l'emporte !
									</p>
									<div class="grid grid-cols-2 gap-3">
										{#each currentQuestion.choices as choice}
											<button
												on:click={() => submitOpinion(choice)}
												class="py-5 rounded-xl font-heading font-bold text-lg
													   bg-surface border-2 border-white/10
													   hover:border-primary/50 hover:bg-surface-light
													   active:scale-95 transition-all"
											>
												{choice}
											</button>
										{/each}
									</div>
								{:else}
									<div
										in:scale={{ duration: 200 }}
										class="w-full card border-accent/30 text-accent text-center text-lg font-heading font-semibold py-5 px-4 flex items-center justify-center gap-2"
									>
										<Lock size={20} weight="bold" />
										{userAnswer}
									</div>
								{/if}
							{:else}
								<!-- Text/Image: text input -->
								{#if !isSubmitted}
									<div>
										<!-- svelte-ignore a11y_autofocus -->
										<input
											type="text"
											bind:value={userAnswer}
											on:keydown={(e) => e.key === 'Enter' && submitAnswer()}
											placeholder="Ta réponse..."
											autofocus
											class="input w-full text-center text-xl md:text-2xl font-heading font-semibold py-4 md:py-5"
										/>
										<p class="text-text-muted text-xs text-center mt-3">
											Envoi automatique à la fin du chrono
										</p>
									</div>
								{:else}
									<div
										in:scale={{ duration: 200 }}
										class="w-full card border-primary/30 text-primary text-center text-lg font-heading font-semibold py-5 px-4 flex items-center justify-center gap-2"
									>
										<Lock size={20} weight="bold" />
										Réponse verrouillée
									</div>
								{/if}
							{/if}
						</div>
					</div>
				{/key}
			</div>
		{:else}
			<div class="text-center mt-20" in:fade>
				<h2 class="text-3xl font-heading font-bold mb-3">Préparez-vous...</h2>
				<p class="text-text-muted">Le jeu va commencer !</p>
			</div>
		{/if}
	</main>
</div>
