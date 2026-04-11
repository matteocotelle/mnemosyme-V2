<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { PUBLIC_BACKEND_URL } from '$env/static/public';
	import {
		Plus,
		Image,
		ChatDots,
		PencilSimple,
		TextT,
		Trash,
		Check,
		CaretDown,
		UploadSimple,
		X,
		Question
	} from 'phosphor-svelte';

	const API = PUBLIC_BACKEND_URL || 'http://localhost:3000';

	type QuestionType = 'text' | 'image' | 'opinion' | 'drawing';

	interface QuestionRow {
		id: string;
		question: string;
		answer: string;
		points: number;
		genre: string;
		type: QuestionType;
		media_url: string | null;
		created_at: string;
	}

	// Form state
	let questionText = '';
	let answer = '';
	let opinionChoiceA = '';
	let opinionChoiceB = '';
	let points = 1;
	let genre = '';
	let customGenre = '';
	let type: QuestionType = 'text';
	let imageFile: File | null = null;
	let imagePreview = '';
	let isSubmitting = false;
	let successMessage = '';
	let errorMessage = '';

	// List state
	let questions: QuestionRow[] = [];
	let genres: string[] = [];
	let showList = false;
	let filterGenre = '';
	let filterType = '';

	// Derived
	$: effectiveGenre = genre === '__custom__' ? customGenre : genre;
	$: effectiveAnswer = type === 'opinion' ? `${opinionChoiceA.trim()}|${opinionChoiceB.trim()}` : answer;
	$: canSubmit =
		questionText.trim() &&
		(type === 'opinion' ? opinionChoiceA.trim() && opinionChoiceB.trim() : answer.trim()) &&
		effectiveGenre.trim() &&
		(type !== 'image' || imageFile) &&
		!isSubmitting;
	$: filteredQuestions = questions.filter(q => {
		if (filterGenre && q.genre !== filterGenre) return false;
		if (filterType && q.type !== filterType) return false;
		return true;
	});

	onMount(async () => {
		await Promise.all([loadGenres(), loadQuestions()]);
	});

	async function loadGenres() {
		try {
			const res = await fetch(`${API}/admin/questions/genres`);
			genres = await res.json();
		} catch {}
	}

	async function loadQuestions() {
		try {
			const res = await fetch(`${API}/admin/questions`);
			questions = await res.json();
		} catch {}
	}

	function handleImageSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		imageFile = file;
		const reader = new FileReader();
		reader.onload = () => (imagePreview = reader.result as string);
		reader.readAsDataURL(file);
	}

	function removeImage() {
		imageFile = null;
		imagePreview = '';
	}

	async function submitQuestion() {
		if (!canSubmit) return;
		isSubmitting = true;
		errorMessage = '';
		successMessage = '';

		try {
			const formData = new FormData();
			formData.append('question', questionText.trim());
			formData.append('answer', effectiveAnswer);
			formData.append('points', String(points));
			formData.append('genre', effectiveGenre.trim());
			formData.append('type', type);

			if (imageFile) {
				formData.append('image', imageFile);
			}

			const res = await fetch(`${API}/admin/questions`, {
				method: 'POST',
				body: formData,
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Erreur serveur');
			}

			successMessage = 'Question ajoutée !';
			resetForm();
			await Promise.all([loadGenres(), loadQuestions()]);

			setTimeout(() => (successMessage = ''), 3000);
		} catch (err: any) {
			errorMessage = err.message || 'Erreur inattendue';
		} finally {
			isSubmitting = false;
		}
	}

	function resetForm() {
		questionText = '';
		answer = '';
		opinionChoiceA = '';
		opinionChoiceB = '';
		points = 1;
		type = 'text';
		imageFile = null;
		imagePreview = '';
		// Keep genre for batch adding
	}

	async function deleteQuestion(id: string) {
		try {
			await fetch(`${API}/admin/questions/${id}`, { method: 'DELETE' });
			questions = questions.filter(q => q.id !== id);
		} catch {}
	}

	const typeIcons: Record<QuestionType, any> = {
		text: TextT,
		image: Image,
		opinion: ChatDots,
		drawing: PencilSimple,
	};

	const typeLabels: Record<QuestionType, string> = {
		text: 'Texte',
		image: 'Image',
		opinion: 'Opinion',
		drawing: 'Dessin',
	};
</script>

<div class="min-h-dvh bg-background px-4 py-6 md:px-8">
	<div class="max-w-2xl mx-auto space-y-6">

		<!-- Header -->
		<header class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-heading font-bold text-text-primary">Admin Questions</h1>
				<p class="text-text-muted text-xs mt-0.5">{questions.length} question{questions.length > 1 ? 's' : ''} en base</p>
			</div>
			<button
				on:click={() => (showList = !showList)}
				class="text-sm text-accent font-medium"
			>
				{showList ? 'Masquer la liste' : 'Voir la liste'}
			</button>
		</header>

		<!-- Success / Error banners -->
		{#if successMessage}
			<div
				transition:fade={{ duration: 200 }}
				class="flex items-center gap-2 bg-success/10 text-success p-3 rounded-xl text-sm border border-success/20"
			>
				<Check size={16} weight="bold" />
				{successMessage}
			</div>
		{/if}
		{#if errorMessage}
			<div
				transition:fade={{ duration: 200 }}
				class="bg-error/10 text-error p-3 rounded-xl text-sm border border-error/20"
			>
				{errorMessage}
			</div>
		{/if}

		<!-- Form -->
		<form
			on:submit|preventDefault={submitQuestion}
			class="card p-5 space-y-5"
		>
			<!-- Type selector -->
			<div>
				<label class="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Type de question</label>
				<div class="grid grid-cols-4 gap-2">
					{#each (['text', 'image', 'opinion', 'drawing'] as QuestionType[]) as t}
						{@const Icon = typeIcons[t]}
						<button
							type="button"
							on:click={() => (type = t)}
							class="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-sm font-medium
								{type === t
									? 'border-primary bg-primary/10 text-primary'
									: 'border-white/10 text-text-muted hover:border-white/20'}"
						>
							<svelte:component this={Icon} size={20} weight={type === t ? 'fill' : 'regular'} />
							{typeLabels[t]}
						</button>
					{/each}
				</div>
			</div>

			<!-- Question text -->
			<div>
				<label for="q-text" class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Question</label>
				<textarea
					id="q-text"
					bind:value={questionText}
					placeholder="Ex: Quel est cet instrument traditionnel ?"
					rows={2}
					class="input w-full resize-none"
				></textarea>
			</div>

			<!-- Answer (conditional) -->
			{#if type === 'opinion'}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="choix-a" class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Choix A</label>
						<input id="choix-a" type="text" bind:value={opinionChoiceA} placeholder="Ex: Chien" class="input w-full" />
					</div>
					<div>
						<label for="choix-b" class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Choix B</label>
						<input id="choix-b" type="text" bind:value={opinionChoiceB} placeholder="Ex: Chat" class="input w-full" />
					</div>
				</div>
			{:else}
				<div>
					<label for="q-answer" class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
						{type === 'drawing' ? 'Sujet du dessin' : 'Réponse'}
					</label>
					<input
						id="q-answer"
						type="text"
						bind:value={answer}
						placeholder={type === 'drawing' ? 'Ex: Un chat' : 'Ex: Koto'}
						class="input w-full"
					/>
				</div>
			{/if}

			<!-- Image upload (only for image type) -->
			{#if type === 'image'}
				<div transition:fade={{ duration: 150 }}>
					<label class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Image</label>
					{#if imagePreview}
						<div class="relative">
							<img src={imagePreview} alt="Preview" class="w-full max-h-48 object-cover rounded-xl border border-white/10" />
							<button
								type="button"
								on:click={removeImage}
								class="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center text-text-muted hover:text-error transition-colors"
							>
								<X size={14} weight="bold" />
							</button>
						</div>
						<p class="text-text-muted text-xs mt-1.5">
							{imageFile?.name} -- sera converti en WebP 800px auto
						</p>
					{:else}
						<label
							class="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-primary/30 cursor-pointer transition-colors"
						>
							<UploadSimple size={24} class="text-text-muted" />
							<span class="text-text-muted text-sm">Glisser ou cliquer</span>
							<span class="text-text-muted text-xs">JPG, PNG, WebP -- 10 Mo max</span>
							<input type="file" accept="image/*" on:change={handleImageSelect} class="hidden" />
						</label>
					{/if}
				</div>
			{/if}

			<!-- Points + Genre row -->
			<div class="grid grid-cols-2 gap-3">
				<!-- Points -->
				<div>
					<label class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Points</label>
					<div class="flex items-center gap-1.5">
						{#each [1, 2, 3] as p}
							<button
								type="button"
								on:click={() => (points = p)}
								class="flex-1 py-2.5 rounded-xl border text-sm font-heading font-bold transition-all
									{points === p
										? 'border-secondary bg-secondary/10 text-secondary'
										: 'border-white/10 text-text-muted hover:border-white/20'}"
							>
								{p}
							</button>
						{/each}
					</div>
				</div>

				<!-- Genre -->
				<div>
					<label for="q-genre" class="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Catégorie</label>
					<div class="relative">
						<select
							id="q-genre"
							bind:value={genre}
							class="input w-full appearance-none pr-8"
						>
							<option value="">Choisir...</option>
							{#each genres as g}
								<option value={g}>{g}</option>
							{/each}
							<option value="__custom__">+ Nouvelle</option>
						</select>
						<CaretDown size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
					</div>
				</div>
			</div>

			<!-- Custom genre input -->
			{#if genre === '__custom__'}
				<div transition:fade={{ duration: 150 }}>
					<input
						type="text"
						bind:value={customGenre}
						placeholder="Nom de la catégorie"
						class="input w-full"
					/>
				</div>
			{/if}

			<!-- Submit -->
			<button
				type="submit"
				disabled={!canSubmit}
				class="w-full py-3.5 rounded-xl font-heading font-semibold text-base transition-all flex items-center justify-center gap-2
					{canSubmit
						? 'btn-primary'
						: 'bg-surface text-text-muted cursor-not-allowed border border-white/5'}"
			>
				{#if isSubmitting}
					<span class="animate-pulse">Envoi...</span>
				{:else}
					<Plus size={18} weight="bold" />
					Ajouter la question
				{/if}
			</button>
		</form>

		<!-- Questions list -->
		{#if showList}
			<div class="space-y-3" transition:fade={{ duration: 200 }}>
				<!-- Filters -->
				<div class="flex gap-2 overflow-x-auto pb-1">
					<button
						on:click={() => (filterType = '')}
						class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
							{!filterType ? 'bg-primary/15 text-primary' : 'bg-surface text-text-muted'}"
					>
						Tous
					</button>
					{#each (['text', 'image', 'opinion', 'drawing'] as QuestionType[]) as t}
						<button
							on:click={() => (filterType = filterType === t ? '' : t)}
							class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
								{filterType === t ? 'bg-primary/15 text-primary' : 'bg-surface text-text-muted'}"
						>
							{typeLabels[t]}
						</button>
					{/each}
				</div>

				{#if filterGenre || genres.length > 0}
					<div class="flex gap-1.5 overflow-x-auto pb-1">
						<button
							on:click={() => (filterGenre = '')}
							class="shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors
								{!filterGenre ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'}"
						>
							Toutes
						</button>
						{#each genres as g}
							<button
								on:click={() => (filterGenre = filterGenre === g ? '' : g)}
								class="shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors
									{filterGenre === g ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'}"
							>
								{g}
							</button>
						{/each}
					</div>
				{/if}

				<p class="text-text-muted text-xs">{filteredQuestions.length} résultat{filteredQuestions.length > 1 ? 's' : ''}</p>

				<!-- List -->
				{#each filteredQuestions as q (q.id)}
					<div
						class="card p-3 flex items-start gap-3"
						transition:fly={{ y: 10, duration: 200 }}
					>
						<div class="shrink-0 w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center">
							<svelte:component this={typeIcons[q.type] || Question} size={16} class="text-text-muted" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-text-primary truncate">{q.question}</p>
							<div class="flex items-center gap-2 mt-1">
								<span class="text-xs text-accent">{q.genre}</span>
								<span class="text-xs text-text-muted">{q.points} pt{q.points > 1 ? 's' : ''}</span>
								<span class="text-xs text-success">{q.answer}</span>
							</div>
						</div>
						<button
							on:click={() => deleteQuestion(q.id)}
							class="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
						>
							<Trash size={16} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
