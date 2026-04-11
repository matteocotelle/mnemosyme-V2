<script lang="ts">
	import { createAvatar } from '@dicebear/core';
	import { adventurer } from '@dicebear/collection';

	export let seed: string;
	export let size: number = 48;

	$: svg = createAvatar(adventurer, {
		seed,
		size,
	}).toString();
</script>

<div
	class="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0"
	style="width: {size}px; height: {size}px;"
>
	{@html svg}
</div>
