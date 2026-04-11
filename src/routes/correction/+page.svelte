<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { scale, fade, fly } from 'svelte/transition';

	import { socket } from '$lib/stores/socket';
	import { game, resetGame } from '$lib/stores/gameState';
	import { playSound } from '$lib/stores/sound';
	import type { Player, GameStats } from '$lib/type';
	import Avatar from '$lib/components/Avatar.svelte';
	import {
		CheckCircle,
		XCircle,
		MinusCircle,
		ArrowRight,
		CheckFat,
		XSquare,
		WifiSlash,
		Crown,
		Check,
		Fire,
		Lightning
	} from 'phosphor-svelte';

	let state: any = null;
	let prevState: any = null;

	// Track streaks per player (socketId → current streak)
	let playerStreaks: Map<string, number> = new Map();
	// Score animations: socketId → { points, id }
	let scoreAnimations: { socketId: string; points: number; id: number }[] = [];
	let animId = 0;

	$: isOpinionQuestion = state?.question?.type === 'opinion';
	$: isDrawingQuestion = state?.question?.type === 'drawing';
	$: isTripleQuestion = state?.question?.isTriple ?? false;
	$: effectivePoints = state?.question?.effectivePoints ?? state?.question?.points ?? 1;
	$: allValidated = (isOpinionQuestion || isDrawingQuestion)
		? (isOpinionQuestion ? true : state?.players.some((p: any) => p.isCorrect === true) ?? false)
		: (state?.players.every((p: any) => p.isCorrect === true || p.isCorrect === false) ?? false);

	function detectScoreChanges(newState: any, oldState: any) {
		if (!newState?.players || !oldState?.players) return;
		if (newState.questionIndex !== oldState.questionIndex) return; // question changed, skip

		for (const player of newState.players) {
			const prev = oldState.players.find((p: any) => p.socketId === player.socketId);
			if (!prev) continue;

			// Player just got validated as correct
			if (player.isCorrect === true && prev.isCorrect !== true) {
				const id = ++animId;
				scoreAnimations = [...scoreAnimations, { socketId: player.socketId, points: effectivePoints, id }];
				setTimeout(() => {
					scoreAnimations = scoreAnimations.filter(a => a.id !== id);
				}, 1200);

				// Vibrate if it's our answer being validated
				if (player.socketId === $game.creatorSocketId) {
					navigator?.vibrate?.(80);
				}
			}
		}
	}

	function getScoreAnim(socketId: string) {
		return scoreAnimations.find(a => a.socketId === socketId);
	}

	onMount(() => {
		if (!$game.roomCode || !$game.myPseudo) {
			resetGame();
			goto('/');
			return;
		}

		socket.emit('requestCorrectionData', { roomId: $game.roomCode });

		socket.on('correctionState', (data) => {
			detectScoreChanges(data, state);
			state = data;
		});

		socket.on('streakUpdate', (data: { socketId: string; playerName: string; currentStreak: number }) => {
			playerStreaks.set(data.socketId, data.currentStreak);
			playerStreaks = new Map(playerStreaks); // trigger reactivity
		});

		socket.on('correctionFinished', (data: { leaderboard: Player[]; stats: GameStats }) => {
			navigator?.vibrate?.([100, 50, 100]);
			game.update((g) => ({
				...g,
				leaderboard: data.leaderboard,
				stats: data.stats
			}));
			goto('/result');
		});
	});

	onDestroy(() => {
		socket.off('correctionState');
		socket.off('correctionFinished');
		socket.off('streakUpdate');
	});

	function togglePlayer(targetSocketId: string) {
		if (!$game.isCreator) return;
		playSound('click', 0.3);
		socket.emit('toggleValidation', {
			roomId: $game.roomCode,
			targetSocketId
		});
	}

	function validateAll(isCorrect: boolean) {
		if (!$game.isCreator) return;
		playSound(isCorrect ? 'success' : 'fail', 0.4);
		socket.emit('validateAll', {
			roomId: $game.roomCode,
			isCorrect
		});
	}

	function nextQuestion() {
		if (!$game.isCreator) return;
		if (!allValidated) return;
		playSound('click', 0.5);
		socket.emit('nextCorrection', { roomId: $game.roomCode });
	}

	function getStreak(socketId: string): number {
		return playerStreaks.get(socketId) || 0;
	}
</script>

<div class="min-h-dvh flex flex-col px-4 pt-5 pb-24">
	<!-- Header -->
	<header class="text-center mb-5">
		<p class="text-primary font-heading font-semibold text-sm uppercase tracking-wider mb-1">
			Correction
		</p>
		{#if state}
			<h2 class="text-xl font-heading font-bold">
				Question {state.questionIndex + 1}
				<span class="text-text-muted font-normal">/ {state.total}</span>
			</h2>
			<!-- Progress dots -->
			<div class="flex items-center justify-center gap-1.5 mt-3">
				{#each Array(state.total) as _, i}
					<div
						class="w-2 h-2 rounded-full transition-colors duration-200
						{i < state.questionIndex
							? 'bg-success'
							: i === state.questionIndex
								? 'bg-primary'
								: 'bg-surface-light'}"
					></div>
				{/each}
			</div>
		{:else}
			<p class="text-text-muted animate-pulse">Chargement...</p>
		{/if}
	</header>

	{#if state}
		<div class="max-w-lg mx-auto w-full space-y-5" in:fade={{ duration: 200 }}>
			<!-- Question card -->
			<div class="card p-5 text-center {isTripleQuestion ? 'border border-secondary/30' : ''}">
				{#if isTripleQuestion}
					<div class="inline-flex items-center gap-1 bg-secondary/15 text-secondary font-heading font-bold text-xs px-2.5 py-1 rounded-lg border border-secondary/30 mb-3">
						<Lightning size={14} weight="fill" />
						x3
					</div>
				{/if}
				<h3 class="text-lg font-heading font-semibold mb-3">{state.question.text}</h3>

				{#if state.question.image}
					<img
						src={state.question.image}
						alt="Question"
						class="mx-auto h-36 rounded-xl mb-3 object-cover"
					/>
				{/if}

				{#if state.question.type === 'drawing'}
					<!-- Drawing: no correct answer, just points -->
					<span class="inline-flex items-center bg-secondary/15 text-secondary text-xs font-semibold px-2.5 py-1 rounded-lg">
						{effectivePoints} pt{effectivePoints > 1 ? 's' : ''} pour le gagnant
					</span>
				{:else if state.question.type === 'opinion' && state.opinionResult}
					<!-- Opinion result: vote bars -->
					<p class="text-accent text-xs font-medium uppercase tracking-wider mb-3">
						{state.opinionResult.isTie ? 'Égalité — tout le monde marque !' : 'La majorité a choisi :'}
					</p>
					<div class="space-y-2">
						{#each state.opinionResult.votes as vote}
							{@const totalVotes = state.opinionResult.votes.reduce((s: number, v: any) => s + v.count, 0)}
							{@const pct = totalVotes > 0 ? Math.round((vote.count / totalVotes) * 100) : 0}
							{@const isWinner = state.opinionResult.isTie || vote.choice === state.opinionResult.majorityChoice}
							<div class="relative rounded-xl overflow-hidden border {isWinner ? 'border-success/30' : 'border-white/10'}">
								<div
									class="absolute inset-0 {isWinner ? 'bg-success/15' : 'bg-surface-light/50'}"
									style="width: {pct}%;"
								></div>
								<div class="relative flex items-center justify-between px-4 py-3">
									<span class="font-heading font-semibold text-sm {isWinner ? 'text-success' : 'text-text-muted'}">
										{#if isWinner}<Check size={14} weight="bold" class="inline mr-1" />{/if}
										{vote.choice}
									</span>
									<span class="font-heading font-bold text-sm {isWinner ? 'text-success' : 'text-text-muted'}">
										{vote.count} vote{vote.count > 1 ? 's' : ''} ({pct}%)
									</span>
								</div>
							</div>
						{/each}
					</div>
					<span class="inline-flex items-center bg-secondary/15 text-secondary text-xs font-semibold px-2.5 py-1 rounded-lg mt-3">
						{effectivePoints} pt{effectivePoints > 1 ? 's' : ''}
					</span>
				{:else}
					<!-- Normal question: show correct answer -->
					<div class="flex items-center justify-center gap-3 flex-wrap">
						<span
							class="inline-flex items-center gap-1.5 bg-success/15 text-success text-sm font-semibold px-3 py-1.5 rounded-xl border border-success/20"
						>
							<Check size={16} weight="bold" />
							{state.question.answer}
						</span>
						<span
							class="inline-flex items-center bg-secondary/15 text-secondary text-xs font-semibold px-2.5 py-1 rounded-lg"
						>
							{effectivePoints} pt{effectivePoints > 1 ? 's' : ''}
						</span>
					</div>
				{/if}
			</div>

			<!-- Bulk actions (creator only, not for opinion/drawing questions) -->
			{#if $game.isCreator && !isOpinionQuestion && !isDrawingQuestion}
				<div class="flex items-center gap-2">
					<button
						on:click={() => validateAll(true)}
						class="flex-1 btn-secondary flex items-center justify-center gap-1.5 py-2 text-sm text-success border-success/20"
					>
						<CheckFat size={16} weight="bold" />
						Tout valider
					</button>
					<button
						on:click={() => validateAll(false)}
						class="flex-1 btn-secondary flex items-center justify-center gap-1.5 py-2 text-sm text-error border-error/20"
					>
						<XSquare size={16} weight="bold" />
						Tout refuser
					</button>
				</div>
			{/if}

			<!-- Drawing mode hint -->
			{#if isDrawingQuestion && $game.isCreator}
				<p class="text-accent text-xs text-center font-medium">
					Choisis le meilleur dessin !
				</p>
			{/if}

			<!-- Player answers -->
			<div class="space-y-2">
				{#each state.players as player (player.socketId)}
					<button
						disabled={!$game.isCreator || isOpinionQuestion}
						on:click={() => togglePlayer(player.socketId)}
						class="w-full text-left transition-transform duration-150 active:scale-[0.97]
							   {player.isDisconnected ? 'opacity-50' : ''}"
					>
						<div
							class="card flex {isDrawingQuestion ? 'flex-col' : 'flex-row items-center'} gap-3 p-3 border-l-4 transition-colors duration-150
							{player.isCorrect === true
								? 'border-l-success bg-success/5'
								: player.isCorrect === false
									? 'border-l-error bg-error/5'
									: 'border-l-surface-light'}"
						>
							<!-- Player info row -->
							<div class="flex items-center gap-3 {isDrawingQuestion ? 'w-full' : 'flex-1 min-w-0'}">
								<div class="relative shrink-0">
									<Avatar seed={player.avatar || player.name} size={36} />
									{#if getScoreAnim(player.socketId)}
										<span
											class="score-float absolute -top-2 left-1/2 -translate-x-1/2 font-heading font-bold text-sm text-success pointer-events-none"
										>
											+{getScoreAnim(player.socketId)?.points}
										</span>
									{/if}
								</div>

								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-1.5 mb-0.5">
										<span class="font-medium text-sm truncate">{player.name}</span>
										{#if getStreak(player.socketId) >= 3}
											<span class="inline-flex items-center gap-0.5 text-xs font-bold text-secondary shrink-0">
												<Fire size={13} weight="fill" class="text-secondary" />
												{getStreak(player.socketId)}
											</span>
										{/if}
										{#if player.isDisconnected}
											<WifiSlash size={12} class="text-text-muted shrink-0" />
										{/if}
										{#if player.socketId === $game.creatorSocketId}
											<Crown size={12} weight="fill" class="text-secondary shrink-0" />
										{/if}
									</div>
									{#if !isDrawingQuestion}
										<p class="text-base truncate">{player.answer}</p>
									{/if}
								</div>

								<!-- Validation icon -->
								<div class="shrink-0">
									{#if player.isCorrect === true}
										<div in:scale={{ duration: 150 }}>
											<CheckCircle size={28} weight="fill" class="text-success" />
										</div>
									{:else if player.isCorrect === false}
										<div in:scale={{ duration: 150 }}>
											<XCircle size={28} weight="fill" class="text-error" />
										</div>
									{:else}
										<MinusCircle size={28} weight="regular" class="text-text-muted" />
									{/if}
								</div>
							</div>

							<!-- Drawing image -->
							{#if isDrawingQuestion && player.answer && player.answer.startsWith('data:')}
								<img
									src={player.answer}
									alt="Dessin de {player.name}"
									class="w-full rounded-xl border border-white/10"
								/>
							{:else if isDrawingQuestion}
								<div class="w-full h-24 rounded-xl bg-surface-light flex items-center justify-center text-text-muted text-sm">
									Pas de dessin
								</div>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Footer -->
	<div class="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-white/5 z-20">
		<div class="max-w-lg mx-auto">
			{#if $game.isCreator}
				<button
					on:click={nextQuestion}
					disabled={!allValidated}
					class="w-full font-heading font-semibold text-base py-3.5 rounded-xl transition-all duration-200
						   flex items-center justify-center gap-2
					{!allValidated
						? 'bg-surface text-text-muted cursor-not-allowed border border-white/5'
						: 'btn-primary'}"
				>
					{#if !allValidated}
						Corrigez toutes les réponses
					{:else}
						Suivant
						<ArrowRight size={18} weight="bold" />
					{/if}
				</button>
			{:else}
				<div class="text-center text-text-muted text-sm py-3">
					En attente du correcteur...
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.score-float {
		animation: floatUp 1.2s ease-out forwards;
	}

	@keyframes floatUp {
		0% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-28px);
		}
	}
</style>
