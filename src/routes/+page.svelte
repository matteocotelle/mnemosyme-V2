<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { page } from '$app/stores';

	import { socket, isConnected } from '$lib/stores/socket';
	import { game } from '$lib/stores/gameState';
	import { playSound } from '$lib/stores/sound';
	import { AVATAR_SEEDS } from '$lib/avatars';
	import AvatarPicker from '$lib/components/AvatarPicker.svelte';
	import Grainient from '$lib/components/Grainient.svelte';
	import { GameController, SignIn, Plus } from 'phosphor-svelte';

	let pseudo = '';
	let roomCode = '';
	let errorMessage = '';
	let isLoading = false;
	let selectedAvatar = AVATAR_SEEDS[0];
	let isInviteMode = false;

	onMount(() => {
		const codeFromUrl = $page.url.searchParams.get('code');
		if (codeFromUrl) {
			roomCode = codeFromUrl;
			isInviteMode = true;
			document.getElementById('pseudo')?.focus();
		}
	});

	function createGame() {
		if (!pseudo.trim()) {
			playSound('fail', 0.5);
			errorMessage = 'Le pseudo est obligatoire !';
			return;
		}
		isLoading = true;
		errorMessage = '';
		playSound('click', 0.5);

		if (!$isConnected) socket.connect();

		socket.emit('createRoom', { pseudo, avatar: selectedAvatar });

		socket.once('roomCreated', (data: { roomId: string }) => {
			joinSuccess(data.roomId);
		});

		socket.once('errorMsg', (msg: string) => {
			errorMessage = msg;
			isLoading = false;
		});
	}

	function joinGame() {
		if (!pseudo.trim() || !roomCode.trim()) {
			playSound('fail', 0.5);
			errorMessage = 'Pseudo et Code Salon requis !';
			return;
		}
		isLoading = true;
		errorMessage = '';

		if (!$isConnected) socket.connect();

		socket.emit('joinRoom', { roomId: roomCode, pseudo, avatar: selectedAvatar });

		socket.once('roomJoined', (data: { roomId: string }) => {
			joinSuccess(data.roomId);
		});

		socket.once('errorMsg', (msg: string) => {
			errorMessage = msg;
			isLoading = false;
		});
	}

	function joinSuccess(id: string) {
		game.update((g) => ({
			...g,
			myPseudo: pseudo,
			myAvatar: selectedAvatar,
			roomCode: id,
			status: 'lobby'
		}));
		goto('/lobby');
	}
</script>

<Grainient
	color1="#1E2237"
	color2="#2A1F1A"
	color3="#141726"
	contrast={1.2}
	saturation={0.8}
	grainAmount={0.06}
	timeSpeed={0.12}
	warpSpeed={0.8}
	warpAmplitude={80.0}
/>

<div class="min-h-dvh flex flex-col items-center justify-center px-5 py-8 relative z-10">
	<!-- Header -->
	<header class="mb-6 text-center" in:fade={{ duration: 400 }}>
		<div class="flex items-center justify-center gap-2 mb-1">
			<h1 class="text-3xl font-heading font-bold text-white drop-shadow-lg">Mnemosyne</h1>
		</div>
		<p class="text-white/60 text-sm">Le test de culture entre amis</p>
	</header>

	<!-- Main card - liquid glass -->
	<div
		class="glass-card w-full max-w-md p-6 space-y-5"
		in:fly={{ y: 20, duration: 500, easing: quintOut }}
	>
		{#if errorMessage}
			<div
				transition:fade={{ duration: 200 }}
				class="bg-error/10 text-error p-3 rounded-xl text-center text-sm border border-error/20"
			>
				{errorMessage}
			</div>
		{/if}

		<!-- Pseudo -->
		<div>
			<label for="pseudo" class="block text-sm font-medium text-text-muted mb-1.5">
				Ton Pseudo
			</label>
			<input
				type="text"
				id="pseudo"
				bind:value={pseudo}
				placeholder="Ex: TheKairi78"
				maxlength="20"
				class="input w-full"
			/>
		</div>

		<!-- Avatar picker -->
		<div>
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label class="block text-sm font-medium text-text-muted mb-2">Ton Avatar</label>
			<AvatarPicker bind:selected={selectedAvatar} />
		</div>

		<!-- Separator -->
		<div class="flex items-center gap-3">
			<div class="flex-1 h-px bg-white/15"></div>
			<span class="text-white/40 text-xs uppercase tracking-wider">ou rejoindre</span>
			<div class="flex-1 h-px bg-white/15"></div>
		</div>

		<!-- Room code -->
		<div>
			<label for="room" class="block text-sm font-medium text-text-muted mb-1.5">
				Code Salon
			</label>
			<input
				type="text"
				id="room"
				bind:value={roomCode}
				placeholder="Ex: 7F9DF2E0"
				class="input w-full uppercase"
			/>
		</div>

		<!-- Buttons -->
		<div class="flex flex-col gap-3 pt-1">
			{#if isInviteMode || roomCode.trim()}
				<button on:click={joinGame} disabled={isLoading} class="btn-primary w-full flex items-center justify-center gap-2">
					<SignIn size={20} weight="bold" />
					{#if isLoading && roomCode}
						<span class="animate-pulse">Connexion...</span>
					{:else}
						Rejoindre la partie
					{/if}
				</button>
				<button on:click={createGame} disabled={isLoading} class="btn-secondary w-full flex items-center justify-center gap-2">
					<Plus size={20} weight="bold" />
					Créer un salon
				</button>
			{:else}
				<button on:click={createGame} disabled={isLoading} class="btn-primary w-full flex items-center justify-center gap-2">
					<Plus size={20} weight="bold" />
					{#if isLoading && !roomCode}
						<span class="animate-pulse">Création...</span>
					{:else}
						Créer un salon
					{/if}
				</button>
				<button on:click={joinGame} disabled={isLoading} class="btn-secondary w-full flex items-center justify-center gap-2">
					<SignIn size={20} weight="bold" />
					Rejoindre une partie
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.glass-card {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.08) 0%,
			rgba(255, 255, 255, 0.03) 50%,
			rgba(255, 255, 255, 0.06) 100%
		);
		backdrop-filter: blur(24px) saturate(1.4);
		-webkit-backdrop-filter: blur(24px) saturate(1.4);
		border-radius: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			inset 0 -1px 0 rgba(255, 255, 255, 0.04);
		position: relative;
		overflow: hidden;
	}

	.glass-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 50%;
		background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.05) 0%,
			transparent 100%
		);
		pointer-events: none;
	}

	.glass-card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 1.25rem;
		background: radial-gradient(
			ellipse at 30% 20%,
			rgba(255, 94, 91, 0.06) 0%,
			transparent 50%
		),
		radial-gradient(
			ellipse at 70% 80%,
			rgba(72, 191, 227, 0.06) 0%,
			transparent 50%
		);
		pointer-events: none;
	}
</style>
