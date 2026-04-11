<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly, scale, fade } from 'svelte/transition';
	import { elasticOut, backOut } from 'svelte/easing';
	import confetti from 'canvas-confetti';

	import { socket } from '$lib/stores/socket';
	import { game, resetGame } from '$lib/stores/gameState';
	import { playSound } from '$lib/stores/sound';
	import type { Player } from '$lib/type';
	import Avatar from '$lib/components/Avatar.svelte';
	import type { ChatMessage } from '$lib/type';
	import { Crown, ArrowCounterClockwise, House, Trophy, Target, Skull, Fire, PaperPlaneRight } from 'phosphor-svelte';

	let winners: Player[] = [];
	let allPlayers: Player[] = [];

	let showThird = false;
	let showSecond = false;
	let showFirst = false;
	let showList = false;
	let chatMessages: ChatMessage[] = [];
	let chatInput = '';
	let chatContainer: HTMLDivElement;
	let timers: ReturnType<typeof setTimeout>[] = [];

	$: stats = $game.stats;
	$: bestStreak = stats?.streaks?.reduce((best, s) => s.maxStreak > best.maxStreak ? s : best, { playerName: '', maxStreak: 0 });

	onMount(() => {
		if (!$game.roomCode || !$game.myPseudo || !$game.leaderboard) {
			resetGame();
			goto('/');
			return;
		}

		const sorted = [...$game.leaderboard].sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.name.localeCompare(b.name);
		});

		winners = sorted.slice(0, 3);
		allPlayers = sorted;

		timers.push(setTimeout(() => (showThird = true), 500));
		timers.push(setTimeout(() => (showSecond = true), 1500));
		timers.push(setTimeout(() => {
			showFirst = true;
			launchConfetti();
			playSound('win', 0.6);
			navigator?.vibrate?.([100, 80, 100, 80, 200]);
		}, 2500));
		timers.push(setTimeout(() => (showList = true), 3500));

		socket.on('gameRestarted', () => {
			game.update((g) => ({ ...g, status: 'lobby' }));
			goto('/lobby');
		});

		socket.on('newChatMessage', (msg: ChatMessage) => {
			chatMessages = [...chatMessages, msg];
			requestAnimationFrame(() => {
				if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
			});
		});
	});

	onDestroy(() => {
		timers.forEach(clearTimeout);
		socket.off('gameRestarted');
		socket.off('newChatMessage');
	});

	function restartGame() {
		playSound('click', 0.5);
		socket.emit('restartGame', { roomId: $game.roomCode });
	}

	function sendChat() {
		const msg = chatInput.trim();
		if (!msg) return;
		socket.emit('chatMessage', { roomId: $game.roomCode, message: msg });
		chatInput = '';
	}

	function handleChatKey(e: KeyboardEvent) {
		if (e.key === 'Enter') sendChat();
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
				colors: ['#FF5E5B', '#FFCD38', '#48BFE3']
			});
			confetti({
				particleCount: 5,
				angle: 120,
				spread: 55,
				origin: { x: 1 },
				colors: ['#FF5E5B', '#FFCD38', '#48BFE3']
			});

			if (Date.now() < end) {
				requestAnimationFrame(frame);
			}
		})();
	}
</script>

<div class="min-h-dvh flex flex-col items-center px-4 pt-6 pb-32 overflow-x-hidden">
	<!-- Header -->
	<header class="text-center mb-6 z-10" in:fade={{ duration: 400 }}>
		<h1 class="text-2xl font-heading font-bold text-secondary flex items-center justify-center gap-2">
			<Trophy size={28} weight="fill" />
			Classement Final
		</h1>
	</header>

	<!-- Podium -->
	<div class="flex items-end justify-center gap-3 w-full max-w-sm mb-8 min-h-[240px]">
		<!-- 2nd place -->
		{#if winners[1] && showSecond}
			<div
				in:fly={{ y: 150, duration: 700, easing: backOut }}
				class="flex flex-col items-center flex-1"
			>
				<Avatar seed={winners[1].avatar || winners[1].name} size={44} />
				<p class="font-heading font-semibold text-sm mt-1 truncate w-full text-center">
					{winners[1].name}
				</p>
				<p class="text-text-muted text-xs">{winners[1].score} pts</p>
				<div
					class="w-full bg-accent/20 h-24 rounded-t-xl flex items-center justify-center mt-2 border-t-2 border-accent"
				>
					<span class="text-3xl font-heading font-bold text-accent/40">2</span>
				</div>
			</div>
		{/if}

		<!-- 1st place -->
		{#if winners[0] && showFirst}
			<div
				in:fly={{ y: 200, duration: 800, easing: elasticOut }}
				class="flex flex-col items-center flex-1 z-10"
			>
				<Crown size={28} weight="fill" class="text-secondary mb-1" />
				<Avatar seed={winners[0].avatar || winners[0].name} size={56} />
				<p class="font-heading font-bold text-base mt-1 text-secondary truncate w-full text-center">
					{winners[0].name}
				</p>
				<p class="text-secondary/80 text-sm font-semibold">{winners[0].score} pts</p>
				<div
					class="w-full bg-secondary/20 h-36 rounded-t-xl flex items-center justify-center mt-2 border-t-2 border-secondary"
				>
					<span class="text-5xl font-heading font-bold text-secondary/30">1</span>
				</div>
			</div>
		{/if}

		<!-- 3rd place -->
		{#if winners[2] && showThird}
			<div
				in:fly={{ y: 120, duration: 700, easing: backOut }}
				class="flex flex-col items-center flex-1"
			>
				<Avatar seed={winners[2].avatar || winners[2].name} size={40} />
				<p class="font-heading font-semibold text-sm mt-1 truncate w-full text-center">
					{winners[2].name}
				</p>
				<p class="text-text-muted text-xs">{winners[2].score} pts</p>
				<div
					class="w-full bg-text-muted/10 h-16 rounded-t-xl flex items-center justify-center mt-2 border-t-2 border-text-muted/30"
				>
					<span class="text-3xl font-heading font-bold text-text-muted/20">3</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Stats cards -->
	{#if showList && stats}
		<div class="w-full max-w-sm grid grid-cols-3 gap-2 mb-6" in:fade={{ duration: 300 }}>
			<div class="card p-3 text-center">
				<Target size={20} weight="duotone" class="text-accent mx-auto mb-1" />
				<p class="text-xs text-text-muted">Score du 1er</p>
				<p class="font-heading font-bold text-lg">
					{stats.winnerCorrectAnswers}/{stats.totalQuestions}
				</p>
			</div>
			<div class="card p-3 text-center">
				<Skull size={20} weight="duotone" class="text-error mx-auto mb-1" />
				<p class="text-xs text-text-muted">La + dure</p>
				<p class="font-heading font-semibold text-xs truncate" title={stats.hardestQuestion}>
					{stats.hardestQuestionCorrectRate}%
				</p>
			</div>
			{#if bestStreak && bestStreak.maxStreak >= 2}
				<div class="card p-3 text-center">
					<Fire size={20} weight="duotone" class="text-secondary mx-auto mb-1" />
					<p class="text-xs text-text-muted">Meilleur streak</p>
					<p class="font-heading font-bold text-sm truncate">
						{bestStreak.maxStreak}x {bestStreak.playerName}
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Full leaderboard -->
	{#if showList && allPlayers.length > 0}
		<div class="w-full max-w-sm space-y-2">
			<h3 class="text-text-muted text-xs uppercase text-center mb-3" in:fade>
				Classement complet
			</h3>
			{#each allPlayers as player, i}
				<div
					in:fly={{
						x: -80,
						duration: 350,
						delay: (allPlayers.length - 1 - i) * 40
					}}
					class="card flex items-center gap-3 p-3
						   {player.isDisconnected ? 'opacity-50' : ''}"
				>
					<span
						class="font-heading font-bold w-6 text-right text-sm
						{i === 0
							? 'text-secondary'
							: i === 1
								? 'text-accent'
								: i === 2
									? 'text-primary'
									: 'text-text-muted'}"
					>
						{i + 1}
					</span>

					<Avatar seed={player.avatar || player.name} size={32} />

					<div class="flex-1 min-w-0">
						<span class="font-medium text-sm truncate block">{player.name}</span>
					</div>

					{#if player.socketId === $game.creatorSocketId}
						<Crown size={14} weight="fill" class="text-secondary shrink-0" />
					{/if}

					<span
						class="font-heading font-semibold text-sm
						{i === 0 ? 'text-secondary' : 'text-text-muted'}"
					>
						{player.score} pts
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Chat in result phase -->
{#if showList}
	<div class="w-full max-w-sm card flex flex-col mt-4 mb-4" style="max-height: 180px;">
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-3 space-y-2">
			{#if chatMessages.length === 0}
				<p class="text-text-muted text-xs text-center py-3">Réagis dans le chat !</p>
			{/if}
			{#each chatMessages as msg}
				<div class="flex items-start gap-2" in:fly={{ y: 8, duration: 200 }}>
					<Avatar seed={msg.avatar || msg.pseudo} size={20} />
					<div class="min-w-0">
						<span class="text-xs font-medium text-accent">{msg.pseudo}</span>
						<p class="text-sm text-text-primary break-words">{msg.message}</p>
					</div>
				</div>
			{/each}
		</div>
		<div class="flex items-center gap-2 p-2 border-t border-white/5">
			<input
				type="text"
				bind:value={chatInput}
				on:keydown={handleChatKey}
				placeholder="Message..."
				maxlength="200"
				class="input flex-1 py-1.5 text-sm"
			/>
			<button
				on:click={sendChat}
				class="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white shrink-0 active:scale-95 transition-transform"
			>
				<PaperPlaneRight size={16} weight="bold" />
			</button>
		</div>
	</div>
{/if}

<!-- Fixed footer -->
<div class="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-white/5 z-30">
	<div class="max-w-sm mx-auto space-y-2">
		{#if $game.isCreator}
			<button
				on:click={restartGame}
				class="btn-primary w-full flex items-center justify-center gap-2"
			>
				<ArrowCounterClockwise size={20} weight="bold" />
				Rejouer
			</button>
		{:else}
			<div class="text-center text-text-muted text-sm py-2">
				En attente de l'hôte...
			</div>
		{/if}

		<button
			on:click={() => { resetGame(); goto('/'); }}
			class="w-full text-text-muted hover:text-text-primary text-sm py-2 flex items-center justify-center gap-1.5 transition-colors"
		>
			<House size={16} weight="bold" />
			Retour à l'accueil
		</button>
	</div>
</div>
