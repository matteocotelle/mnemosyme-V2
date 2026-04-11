import { writable, get } from 'svelte/store';
import { Howl } from 'howler';

// Persist mute state in localStorage
const storedMute =
	typeof window !== 'undefined' ? localStorage.getItem('mnemosyme-muted') === 'true' : false;
export const isMuted = writable(storedMute);

isMuted.subscribe((v) => {
	if (typeof window !== 'undefined') {
		localStorage.setItem('mnemosyme-muted', String(v));
	}
});

const soundLibrary = {
	click: '/sounds/click1.wav',
	success: '/sounds/success.mp3',
	fail: '/sounds/error.wav',
	join: '/sounds/join.mp3',
	win: '/sounds/win.mp3',
	timer: '/sounds/timer-tick.mp3',
	'timer-urgent': '/sounds/timer-urgent.mp3',
	whoosh: '/sounds/whoosh.mp3',
	send: '/sounds/send.mp3',
};

export type SoundType = keyof typeof soundLibrary;

const howlCache = new Map<string, Howl>();

function getHowl(type: SoundType): Howl {
	let howl = howlCache.get(type);
	if (!howl) {
		howl = new Howl({
			src: [soundLibrary[type]],
			preload: false,
			volume: 1,
		});
		howlCache.set(type, howl);
	}
	return howl;
}

export function playSound(type: SoundType, volume: number = 1) {
	if (typeof window === 'undefined') return;
	if (get(isMuted)) return;

	try {
		const howl = getHowl(type);
		howl.volume(volume);

		if (howl.state() === 'unloaded') {
			howl.load();
			howl.once('load', () => howl.play());
		} else {
			howl.play();
		}
	} catch (err) {
		console.warn(`Son non disponible : ${type}`, err);
	}
}

export function toggleMute() {
	isMuted.update((m) => !m);
}
