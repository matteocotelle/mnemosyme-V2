import { writable, get } from 'svelte/store';

// Store pour savoir si le son est coupé ou non (persistant via localStorage si tu veux aller plus loin)
export const isMuted = writable(false);

// La liste de tes fichiers (Mets ici les noms exacts de tes fichiers dans static/sounds)
const soundLibrary = {
    click: '/sounds/click1.wav',
    success: '/sounds/success.mp3',
    fail: '/sounds/error.wav',
    join: '/sounds/join.mp3',
    win: '/sounds/win.mp3',
    timer: '/sounds/timer-tick.mp3' // Optionnel : bruit du chrono
};

// Type pour l'autocomplétion (pour ne pas se tromper de nom)
export type SoundType = keyof typeof soundLibrary;

// Cache pour éviter de recharger le fichier à chaque fois
const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Joue un son spécifique
 * @param type Le nom du son (ex: 'click', 'success')
 * @param volume Le volume entre 0 et 1 (défaut: 1)
 */
export function playSound(type: SoundType, volume: number = 1) {
    // 1. Si on est sur le serveur (SSR) ou si c'est muté, on ne fait rien
    if (typeof window === 'undefined') return;
    if (get(isMuted)) return;

    try {
        let audio = audioCache.get(type);

        // 2. Si le son n'est pas en cache, on le crée
        if (!audio) {
            audio = new Audio(soundLibrary[type]);
            audioCache.set(type, audio);
        }

        // 3. Reset du son (pour pouvoir spammer le clic) et jeu
        audio.currentTime = 0; 
        audio.volume = volume;
        audio.play().catch(e => console.warn("Erreur lecture audio (autoplay bloqué ?)", e));
        
    } catch (err) {
        console.error(`Impossible de jouer le son : ${type}`, err);
    }
}

/**
 * Fonction helper pour basculer le mute
 */
export function toggleMute() {
    isMuted.update(m => !m);
}