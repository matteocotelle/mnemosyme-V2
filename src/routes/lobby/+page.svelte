<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fade, fly, scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	import { socket, isConnected } from '$lib/stores/socket';
	import { game, resetGame } from '$lib/stores/gameState';
	import { playSound } from '$lib/stores/sound';
	import type { Player, ChatMessage, GameSettings } from '$lib/type';
	import Avatar from '$lib/components/Avatar.svelte';
	import {
		Copy, Crown, PaperPlaneRight, Play, SignOut, UserCircleDashed,
		GearSix, Timer, ListNumbers, ArrowsClockwise, Tag
	} from 'phosphor-svelte';

	let copied = false;
	let chatMessages: ChatMessage[] = [];
	let chatInput = '';
	let chatContainer: HTMLDivElement;
	let showSettings = false;

	const questionCountOptions = [5, 10, 15, 20] as const;
	const timerOptions = [10, 15, 20, 30] as const;

	onMount(() => {
		const urlRoom = $page.url.searchParams.get('room');
		const urlName = $page.url.searchParams.get('name');

		if (!$game.roomCode && urlRoom) {
			game.update((g) => ({ ...g, roomCode: urlRoom || '', myPseudo: urlName || '' }));
			if (!$isConnected) socket.connect();
			socket.emit('joinRoom', { roomId: urlRoom, name: urlName, avatar: $game.myAvatar });
		} else if ($game.roomCode && $game.myPseudo) {
			socket.emit('requestRoomData', { roomId: $game.roomCode });
		} else {
			resetGame();
			goto('/');
			return;
		}

		socket.on('roomData', (data: any) => {
			const prevCount = $game.players.length;
			game.update((g) => ({
				...g,
				players: data.players.map((p: Player) => ({
					...p,
					isCreator: p.socketId === data.creatorSocketId
				})),
				isCreator: socket.id === data.creatorSocketId,
				settings: data.settings || g.settings,
			}));
			if (data.players.length > prevCount && prevCount > 0) {
				playSound('join', 0.4);
			}
		});

		socket.on('gameSettings', (data: { settings: GameSettings }) => {
			game.update((g) => ({ ...g, settings: data.settings }));
		});

		socket.on('availableCategories', (data: { categories: string[] }) => {
			game.update((g) => ({ ...g, availableCategories: data.categories }));
		});

		socket.on('newChatMessage', (msg: ChatMessage) => {
			chatMessages = [...chatMessages, msg];
			playSound('send', 0.3);
			requestAnimationFrame(() => {
				if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
			});
		});

		socket.on('gameStarted', () => {
			goto('/game');
		});

		// Request categories
		socket.emit('requestCategories');
	});

	onDestroy(() => {
		socket.off('roomData');
		socket.off('gameStarted');
		socket.off('newChatMessage');
		socket.off('gameSettings');
		socket.off('availableCategories');
	});

	function updateSetting(partial: Partial<GameSettings>) {
		socket.emit('updateGameSettings', { roomId: $game.roomCode, settings: partial });
	}

	function toggleCategory(cat: string) {
		const current = $game.settings.categories;
		const updated = current.includes(cat)
			? current.filter((c) => c !== cat)
			: [...current, cat];
		updateSetting({ categories: updated });
	}

	function startGame() {
		playSound('click', 0.5);
		socket.emit('startGame', { roomId: $game.roomCode });
	}

	function leaveGame() {
		socket.disconnect();
		resetGame();
		goto('/');
	}

	async function copyLink() {
		const url = `${window.location.origin}/?code=${$game.roomCode}`;
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			playSound('click', 0.3);
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Erreur copie', err);
		}
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

	function timeAgo(ts: number): string {
		const diff = Math.floor((Date.now() - ts) / 1000);
		if (diff < 60) return 'maintenant';
		return `il y a ${Math.floor(diff / 60)}min`;
	}
</script>

<div class="min-h-dvh flex flex-col px-4 py-5">
	<!-- Header: room code + copy -->
	<header class="flex items-center justify-center gap-3 mb-4" in:fade={{ duration: 300 }}>
		<div class="card px-4 py-2 flex items-center gap-3">
			<span class="text-text-muted text-sm">Salon</span>
			<span class="font-heading font-bold text-lg text-primary tracking-wide">{$game.roomCode}</span>
			<button
				on:click={copyLink}
				class="flex items-center gap-1 text-xs bg-surface-light hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors text-text-muted"
			>
				<Copy size={14} weight="bold" />
				{copied ? 'Copié !' : 'Copier'}
			</button>
		</div>
	</header>

	<!-- Player count -->
	<p class="text-center text-text-muted text-sm mb-3">
		{$game.players.length} joueur{$game.players.length > 1 ? 's' : ''} connecté{$game.players.length > 1 ? 's' : ''}
	</p>

	<!-- Player grid -->
	<div class="grid grid-cols-2 gap-3 w-full max-w-lg mx-auto mb-4">
		{#each $game.players as player (player.socketId)}
			<div
				animate:flip={{ duration: 300 }}
				in:scale={{ duration: 250, start: 0.9 }}
				class="card p-3 flex flex-col items-center gap-1.5"
			>
				<Avatar seed={player.avatar || player.name} size={48} />
				<p class="font-heading font-semibold text-sm truncate w-full text-center">
					{player.name}
				</p>
				<div class="flex flex-col items-center gap-0.5 min-h-[1rem]">
					{#if player.isCreator}
						<span class="inline-flex items-center gap-1 text-xs text-secondary font-medium bg-secondary/10 px-2 py-0.5 rounded-full">
							<Crown size={12} weight="fill" />
							Hôte
						</span>
					{/if}
					{#if player.name === $game.myPseudo}
						<span class="text-xs text-text-muted">(Toi)</span>
					{/if}
				</div>
			</div>
		{/each}

		{#if $game.players.length < 4}
			{#each Array(4 - $game.players.length) as _}
				<div class="border-2 border-dashed border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 opacity-40">
					<UserCircleDashed size={32} weight="regular" class="text-text-muted" />
					<span class="text-text-muted text-xs">En attente</span>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Game Settings (creator only) -->
	{#if $game.isCreator}
		<div class="w-full max-w-lg mx-auto mb-4">
			<button
				on:click={() => (showSettings = !showSettings)}
				class="flex items-center gap-2 text-text-muted text-sm hover:text-text-primary transition-colors mb-2"
			>
				<GearSix size={16} weight="bold" />
				{showSettings ? 'Masquer' : 'Paramètres de la partie'}
			</button>

			{#if showSettings}
				<div class="card p-4 space-y-4" transition:fly={{ y: -10, duration: 200 }}>
					<!-- Question count -->
					<div>
						<div class="flex items-center gap-1.5 text-sm text-text-muted mb-2">
							<ListNumbers size={14} weight="bold" />
							Nombre de questions
						</div>
						<div class="flex gap-2">
							{#each questionCountOptions as opt}
								<button
									on:click={() => updateSetting({ questionCount: opt })}
									class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors
										{$game.settings.questionCount === opt
											? 'bg-primary text-white'
											: 'bg-surface-light text-text-muted hover:bg-white/10'}"
								>
									{opt}
								</button>
							{/each}
						</div>
					</div>

					<!-- Timer -->
					<div>
						<div class="flex items-center gap-1.5 text-sm text-text-muted mb-2">
							<Timer size={14} weight="bold" />
							Temps par question
						</div>
						<div class="flex gap-2">
							{#each timerOptions as opt}
								<button
									on:click={() => updateSetting({ timerSeconds: opt })}
									class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors
										{$game.settings.timerSeconds === opt
											? 'bg-primary text-white'
											: 'bg-surface-light text-text-muted hover:bg-white/10'}"
								>
									{opt}s
								</button>
							{/each}
						</div>
					</div>

					<!-- No repeat toggle -->
					<button
						on:click={() => updateSetting({ noRepeat: !$game.settings.noRepeat })}
						class="w-full flex items-center justify-between p-3 rounded-xl transition-colors
							{$game.settings.noRepeat ? 'bg-primary/10 border border-primary/30' : 'bg-surface-light border border-white/5'}"
					>
						<div class="flex items-center gap-2 text-sm">
							<ArrowsClockwise size={16} weight="bold" class={$game.settings.noRepeat ? 'text-primary' : 'text-text-muted'} />
							<span class={$game.settings.noRepeat ? 'text-text-primary' : 'text-text-muted'}>
								Éviter les doublons
							</span>
						</div>
						<div class="w-10 h-6 rounded-full transition-colors flex items-center px-0.5
							{$game.settings.noRepeat ? 'bg-primary' : 'bg-surface'}">
							<div class="w-5 h-5 rounded-full bg-white transition-transform shadow
								{$game.settings.noRepeat ? 'translate-x-4' : 'translate-x-0'}"></div>
						</div>
					</button>

					<!-- Categories -->
					{#if $game.availableCategories.length > 0}
						<div>
							<div class="flex items-center gap-1.5 text-sm text-text-muted mb-2">
								<Tag size={14} weight="bold" />
								Catégories
								<span class="text-xs">
									({$game.settings.categories.length === 0 ? 'toutes' : $game.settings.categories.length})
								</span>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each $game.availableCategories as cat}
									<button
										on:click={() => toggleCategory(cat)}
										class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
											{$game.settings.categories.includes(cat)
												? 'bg-accent/20 text-accent border border-accent/30'
												: $game.settings.categories.length === 0
													? 'bg-accent/10 text-accent/70 border border-accent/10'
													: 'bg-surface-light text-text-muted border border-white/5'}"
									>
										{cat}
									</button>
								{/each}
							</div>
							<p class="text-xs text-text-muted mt-1.5">
								{$game.settings.categories.length === 0
									? 'Toutes les catégories sont actives'
									: `${$game.settings.categories.length} catégorie${$game.settings.categories.length > 1 ? 's' : ''} sélectionnée${$game.settings.categories.length > 1 ? 's' : ''}`}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Non-creator: show current settings summary -->
		<div class="w-full max-w-lg mx-auto mb-4">
			<div class="card px-4 py-2.5 flex items-center justify-center gap-4 text-xs text-text-muted">
				<span class="flex items-center gap-1">
					<ListNumbers size={12} weight="bold" />
					{$game.settings.questionCount} questions
				</span>
				<span class="flex items-center gap-1">
					<Timer size={12} weight="bold" />
					{$game.settings.timerSeconds}s
				</span>
				{#if $game.settings.noRepeat}
					<span class="flex items-center gap-1">
						<ArrowsClockwise size={12} weight="bold" class="text-primary" />
						Anti-doublon
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Chat section -->
	<div class="card w-full max-w-lg mx-auto flex flex-col flex-1 min-h-0 mb-4" style="max-height: 200px;">
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-3 space-y-2">
			{#if chatMessages.length === 0}
				<p class="text-text-muted text-xs text-center py-4">Le chat est vide. Dis bonjour !</p>
			{/if}
			{#each chatMessages as msg}
				<div class="flex items-start gap-2" in:fly={{ y: 10, duration: 200 }}>
					<Avatar seed={msg.avatar || msg.pseudo} size={24} />
					<div class="min-w-0">
						<span class="text-xs font-medium text-accent">{msg.pseudo}</span>
						<span class="text-xs text-text-muted ml-1">{timeAgo(msg.timestamp)}</span>
						<p class="text-sm text-text-primary break-words">{msg.message}</p>
					</div>
				</div>
			{/each}
		</div>
		<div class="flex items-center gap-2 p-3 border-t border-white/5">
			<input
				type="text"
				bind:value={chatInput}
				on:keydown={handleChatKey}
				placeholder="Envoyer un message..."
				maxlength="200"
				class="input flex-1 py-2 text-sm"
			/>
			<button
				on:click={sendChat}
				class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white shrink-0 active:scale-95 transition-transform"
			>
				<PaperPlaneRight size={18} weight="bold" />
			</button>
		</div>
	</div>

	<!-- Footer actions -->
	<footer class="w-full max-w-lg mx-auto space-y-3 mt-auto pt-2">
		{#if $game.isCreator}
			<button
				on:click={startGame}
				class="btn-primary w-full flex items-center justify-center gap-2 text-lg"
				in:fly={{ y: 10, duration: 300 }}
			>
				<Play size={22} weight="fill" />
				Lancer la partie
			</button>
		{:else}
			<div class="text-center p-4 card text-text-muted text-sm" in:fade>
				L'hôte va lancer la partie...
			</div>
		{/if}

		<button
			on:click={leaveGame}
			class="w-full py-3 rounded-xl text-sm text-text-muted hover:text-error transition-colors flex items-center justify-center gap-2"
		>
			<SignOut size={16} weight="bold" />
			Quitter le salon
		</button>
	</footer>
</div>
