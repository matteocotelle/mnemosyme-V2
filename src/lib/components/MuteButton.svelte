<script lang="ts">
	import { isMuted, toggleMute } from '$lib/stores/sound';
	import { SpeakerHigh, SpeakerSlash } from 'phosphor-svelte';
</script>

<button
	on:click={toggleMute}
	class="fixed top-4 right-4 z-50 flex items-center justify-center w-10 h-10
		   rounded-full bg-surface border border-white/10 text-text-muted
		   hover:text-text-primary transition-colors duration-200"
	aria-label={$isMuted ? 'Activer le son' : 'Couper le son'}
>
	{#if $isMuted}
		<SpeakerSlash size={20} weight="bold" />
	{:else}
		<SpeakerHigh size={20} weight="bold" />
	{/if}
</button>
