<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Renderer, Program, Mesh, Triangle } from 'ogl';

	export let color1 = '#FF5E5B';
	export let color2 = '#FFCD38';
	export let color3 = '#48BFE3';
	export let timeSpeed = 0.2;
	export let grainAmount = 0.08;
	export let warpStrength = 1.0;
	export let warpFrequency = 4.0;
	export let warpSpeed = 1.5;
	export let warpAmplitude = 50.0;
	export let contrast = 1.4;
	export let saturation = 1.0;
	export let zoom = 0.9;

	let container: HTMLDivElement;
	let raf: number;
	let ro: ResizeObserver;

	function hexToRgb(hex: string): number[] {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (!result) return [1, 1, 1];
		return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
	}

	const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

	const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uGrainAmount;
uniform float uContrast;
uniform float uSaturation;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;

mat2 Rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
vec2 hash(vec2 p) { p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37))); return fract(sin(p) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(dot(-1.0 + 2.0 * hash(i), f), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
  return 0.5 + 0.5 * n;
}

void main() {
  float t = iTime * uTimeSpeed;
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float ratio = iResolution.x / iResolution.y;
  vec2 tuv = uv - 0.5;
  tuv /= max(uZoom, 0.001);

  float degree = noise(vec2(t * 0.1, tuv.x * tuv.y) * 2.0);
  tuv.y *= 1.0 / ratio;
  tuv *= Rot(radians((degree - 0.5) * 500.0 + 180.0));
  tuv.y *= ratio;

  float frequency = uWarpFrequency;
  float ws = max(uWarpStrength, 0.001);
  float amplitude = uWarpAmplitude / ws;
  float warpTime = t * uWarpSpeed;
  tuv.x += sin(tuv.y * frequency + warpTime) / amplitude;
  tuv.y += sin(tuv.x * (frequency * 1.5) + warpTime) / (amplitude * 0.5);

  float s = 0.05;
  float blendX = tuv.x;
  vec3 layer1 = mix(uColor3, uColor2, smoothstep(-0.3 - s, 0.2 + s, blendX));
  vec3 layer2 = mix(uColor2, uColor1, smoothstep(-0.3 - s, 0.2 + s, blendX));
  vec3 col = mix(layer1, layer2, smoothstep(0.5 + s, -0.3 - s, tuv.y));

  // Grain
  vec2 grainUv = uv * 2.0 + vec2(iTime * 0.05);
  float grain = fract(sin(dot(grainUv, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * uGrainAmount;

  col = (col - 0.5) * uContrast + 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col = clamp(col, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}`;

	onMount(() => {
		if (!container) return;

		const renderer = new Renderer({
			webgl: 2,
			alpha: true,
			antialias: false,
			dpr: Math.min(window.devicePixelRatio || 1, 2),
		});

		const gl = renderer.gl;
		const canvas = gl.canvas as HTMLCanvasElement;
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		canvas.style.display = 'block';
		container.appendChild(canvas);

		const geometry = new Triangle(gl);
		const program = new Program(gl, {
			vertex,
			fragment,
			uniforms: {
				iTime: { value: 0 },
				iResolution: { value: new Float32Array([1, 1]) },
				uTimeSpeed: { value: timeSpeed },
				uWarpStrength: { value: warpStrength },
				uWarpFrequency: { value: warpFrequency },
				uWarpSpeed: { value: warpSpeed },
				uWarpAmplitude: { value: warpAmplitude },
				uGrainAmount: { value: grainAmount },
				uContrast: { value: contrast },
				uSaturation: { value: saturation },
				uZoom: { value: zoom },
				uColor1: { value: new Float32Array(hexToRgb(color1)) },
				uColor2: { value: new Float32Array(hexToRgb(color2)) },
				uColor3: { value: new Float32Array(hexToRgb(color3)) },
			},
		});

		const mesh = new Mesh(gl, { geometry, program });

		const setSize = () => {
			const rect = container.getBoundingClientRect();
			const width = Math.max(1, Math.floor(rect.width));
			const height = Math.max(1, Math.floor(rect.height));
			renderer.setSize(width, height);
			const res = program.uniforms.iResolution.value;
			res[0] = gl.drawingBufferWidth;
			res[1] = gl.drawingBufferHeight;
		};

		ro = new ResizeObserver(setSize);
		ro.observe(container);
		setSize();

		const t0 = performance.now();
		const loop = (t: number) => {
			program.uniforms.iTime.value = (t - t0) * 0.001;
			renderer.render({ scene: mesh });
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			try { container.removeChild(canvas); } catch {}
		};
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		if (ro) ro.disconnect();
	});
</script>

<div bind:this={container} class="grainient"></div>

<style>
	.grainient {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
	}
</style>
