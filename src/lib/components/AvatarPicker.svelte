<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { AVATAR_SEEDS } from '$lib/avatars';

	export let selected: string = AVATAR_SEEDS[0];
</script>

<div class="grid grid-cols-4 gap-2">
	{#each AVATAR_SEEDS as seed}
		<button
			type="button"
			class="flex items-center justify-center p-1.5 rounded-xl transition-all duration-150
				{selected === seed
					? 'ring-2 ring-primary bg-surface-light scale-105'
					: 'bg-transparent hover:bg-surface-light/50 active:scale-95'}"
			on:click={() => (selected = seed)}
		>
			<Avatar {seed} size={44} />
		</button>
	{/each}
</div>
