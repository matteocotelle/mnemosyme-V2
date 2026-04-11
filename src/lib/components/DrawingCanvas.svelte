<script lang="ts">
	import { onMount } from 'svelte';
	import { Eraser, PaintBrush, Palette } from 'phosphor-svelte';

	export let disabled = false;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isDrawing = false;
	let brushSize = 4;
	let currentColor = '#F0F0F5';

	const CANVAS_SIZE = 300;
	const BRUSH_SIZES = [3, 6, 12];
	const COLORS = [
		'#F0F0F5', // white
		'#FF5E5B', // coral
		'#FFCD38', // yellow
		'#48BFE3', // blue
		'#34D399', // green
		'#F87171', // red
		'#8B5CF6', // purple
		'#000000', // black (for erasing on dark bg, acts as bg color)
	];

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		clearCanvas();
	});

	function clearCanvas() {
		if (!ctx) return;
		ctx.fillStyle = '#1E2237'; // surface color as background
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
	}

	function getPos(e: TouchEvent | MouseEvent): { x: number; y: number } {
		const rect = canvas.getBoundingClientRect();
		const scale = CANVAS_SIZE / rect.width;

		if ('touches' in e) {
			const touch = e.touches[0];
			return {
				x: (touch.clientX - rect.left) * scale,
				y: (touch.clientY - rect.top) * scale,
			};
		}
		return {
			x: ((e as MouseEvent).clientX - rect.left) * scale,
			y: ((e as MouseEvent).clientY - rect.top) * scale,
		};
	}

	function startDraw(e: TouchEvent | MouseEvent) {
		if (disabled) return;
		e.preventDefault();
		isDrawing = true;
		const pos = getPos(e);
		ctx.beginPath();
		ctx.moveTo(pos.x, pos.y);
	}

	function draw(e: TouchEvent | MouseEvent) {
		if (!isDrawing || disabled) return;
		e.preventDefault();
		const pos = getPos(e);
		ctx.strokeStyle = currentColor;
		ctx.lineWidth = brushSize;
		ctx.lineTo(pos.x, pos.y);
		ctx.stroke();
	}

	function endDraw() {
		isDrawing = false;
	}

	export function getDataUrl(): string {
		return canvas?.toDataURL('image/jpeg', 0.6) || '';
	}

	function cycleBrushSize() {
		const idx = BRUSH_SIZES.indexOf(brushSize);
		brushSize = BRUSH_SIZES[(idx + 1) % BRUSH_SIZES.length];
	}
</script>

<div class="flex flex-col items-center gap-3 w-full">
	<!-- Canvas -->
	<div
		class="rounded-2xl overflow-hidden border-2 border-white/10 touch-none"
		style="width: 100%; max-width: {CANVAS_SIZE}px; aspect-ratio: 1;"
	>
		<canvas
			bind:this={canvas}
			width={CANVAS_SIZE}
			height={CANVAS_SIZE}
			class="w-full h-full"
			on:mousedown={startDraw}
			on:mousemove={draw}
			on:mouseup={endDraw}
			on:mouseleave={endDraw}
			on:touchstart={startDraw}
			on:touchmove={draw}
			on:touchend={endDraw}
			on:touchcancel={endDraw}
		></canvas>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center gap-2 flex-wrap justify-center">
		<!-- Colors -->
		{#each COLORS as color}
			<button
				type="button"
				on:click={() => (currentColor = color)}
				aria-label="Couleur {color}"
				class="w-8 h-8 rounded-full border-2 transition-transform
					{currentColor === color ? 'scale-110 border-white' : 'border-white/20'}"
				style="background-color: {color};"
			></button>
		{/each}

		<!-- Separator -->
		<div class="w-px h-6 bg-white/10 mx-1"></div>

		<!-- Brush size -->
		<button
			type="button"
			on:click={cycleBrushSize}
			class="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-light border border-white/10 text-text-muted hover:text-text-primary transition-colors"
			title="Taille du pinceau"
		>
			<PaintBrush size={brushSize <= 3 ? 14 : brushSize <= 6 ? 18 : 22} weight="bold" />
		</button>

		<!-- Reset -->
		<button
			type="button"
			on:click={clearCanvas}
			class="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-light border border-white/10 text-text-muted hover:text-error transition-colors"
			title="Effacer tout"
		>
			<Eraser size={18} weight="bold" />
		</button>
	</div>
</div>
