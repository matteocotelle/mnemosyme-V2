<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fly, fade } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    
    // Import de nos stores
    import { socket, isConnected } from '$lib/stores/socket';
    import { game } from '$lib/stores/gameState';
    import { playSound } from '$lib/stores/sound';
    import { page } from '$app/stores';

    let pseudo = '';
    let roomCode = '';
    let errorMessage = '';
    let isLoading = false;

    // Nouvelle variable pour gérer l'UX du bouton
    let isInviteMode = false;

    // Gestion des étoiles filantes
    interface Star { id: number; top: number; duration: number; }
    let stars: Star[] = [];

    onMount(() => {
        // 1. GESTION DU LIEN D'INVITATION
        const codeFromUrl = $page.url.searchParams.get('code');
        if (codeFromUrl) {
            roomCode = codeFromUrl;
            isInviteMode = true; // On active le mode "invité"
            document.getElementById('pseudo')?.focus();
        }

        // 2. GÉNÉRATEUR D'ÉTOILES FILANTES
        // On fait apparaître une étoile toutes les X millisecondes
        const interval = setInterval(() => {
            const id = Date.now();
            const newStar = {
                id,
                top: Math.random() * 100, // Hauteur aléatoire (0-100%)
                duration: 2 + Math.random() * 3 // Vitesse entre 2s et 5s
            };

            stars = [...stars, newStar];

            // Nettoyage : on supprime l'étoile après son passage pour ne pas surcharger le DOM
            setTimeout(() => {
                stars = stars.filter(s => s.id !== id);
            }, newStar.duration * 1000);

        }, 1500); // Une nouvelle étoile toutes les 1.5 secondes

        return () => clearInterval(interval);
    });

    function createGame() {

        if (!pseudo.trim()) {
            playSound('fail', 0.5);
            errorMessage = "Le pseudo est obligatoire !";
            return;
        }
        isLoading = true;
        errorMessage = '';

		playSound('click', 0.5);

        if (!$isConnected) socket.connect();

        socket.emit('createRoom', { pseudo });

        socket.once('roomCreated', (data: { roomId: string }) => {
            joinSuccess(data.roomId);
        });
    }

    function joinGame() {
        if (!pseudo.trim() || !roomCode.trim()) {
            playSound('fail', 0.5);
            errorMessage = "Pseudo et Code Salon requis !";
            return;
        }
        isLoading = true;
        errorMessage = '';

        if (!$isConnected) socket.connect();

        socket.emit('joinRoom', { roomId: roomCode, pseudo });

        socket.once('roomJoined', (data: { roomId: string }) => {
            joinSuccess(data.roomId);
        });

        socket.once('errorMsg', (msg: string) => {
            errorMessage = msg;
            isLoading = false;
        });
    }

    function joinSuccess(id: string) {
        game.update(g => ({
            ...g,
            myPseudo: pseudo,
            roomCode: id,
            status: 'lobby'
        }));
        goto('/lobby');
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-brand-dark to-slate-800 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">

    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {#each stars as star (star.id)}
            <div 
                class="shooting-star"
                style="top: {star.top}%; animation-duration: {star.duration}s;"
            ></div>
        {/each}
    </div>

    <header class="mb-8 text-center animate-float z-10">
        <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary drop-shadow-lg">
            Mnemosyne
        </h1>
        <p class="text-slate-400 mt-2 text-sm uppercase tracking-widest">Le test de culture ultime</p>
    </header>

    <div 
        in:fly={{ y: 50, duration: 800, easing: quintOut }} 
        class="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/10 rounded-3xl p-8 shadow-2xl z-10 relative"
    >
        
        {#if errorMessage}
            <div transition:fade class="bg-red-500/20 text-red-200 p-3 rounded-lg mb-4 text-center text-sm border border-red-500/30">
                {errorMessage}
            </div>
        {/if}

        <div class="space-y-6">
            <div class="group">
                <label for="pseudo" class="block text-sm font-medium text-slate-300 mb-1 ml-1">Ton Pseudo</label>
                <input 
                    type="text" 
                    id="pseudo" 
                    bind:value={pseudo} 
                    placeholder="Ex: TheKairi78"
                    class="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-4 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all placeholder-slate-600"
                />
            </div>

            <div class="relative flex items-center py-2">
                <div class="flex-grow border-t border-slate-700"></div>
                <span class="flex-shrink-0 mx-4 text-slate-500 text-xs">OPTIONS DE JEU</span>
                <div class="flex-grow border-t border-slate-700"></div>
            </div>

            <div class="group">
                <label for="room" class="block text-sm font-medium text-slate-300 mb-1 ml-1">Code Salon (pour rejoindre)</label>
                <input 
                    type="text" 
                    id="room" 
                    bind:value={roomCode} 
                    placeholder="Ex: 7F9DF2E0"
                    class="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-4 focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none transition-all placeholder-slate-600"
                />
            </div>

            <div class="flex flex-col gap-3 mt-4">
                <button 
                    on:click={joinGame}
                    disabled={isLoading}
                    class="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-brand-secondary to-pink-600 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50"
                >
                    {#if isLoading && roomCode}
                        <span class="animate-pulse">Connexion...</span>
                    {:else}
                        Rejoindre une partie
                    {/if}
                </button>

                <button 
                    on:click={createGame}
                    disabled={isLoading}
                    class="w-full py-4 rounded-xl font-bold text-lg active:scale-95 transition-all 
                    {isInviteMode 
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-400 border border-slate-600'  /* GRIS + Bordure */
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-cyan-500/20' /* BLEU sans bordure */
                    }"
                >
                    Créer un nouveau salon
                </button>
            </div>
        </div>
    </div>

    <div class="absolute top-[-10%] left-[-10%] w-64 h-64 bg-brand-primary rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-brand-secondary rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

</div>

<style>
    /* Animation pour les Blobs de fond */
    @keyframes blob {
        0% { transform: translate(0px, 0px) scale(1); }
        33% { transform: translate(30px, -50px) scale(1.1); }
        66% { transform: translate(-20px, 20px) scale(0.9); }
        100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-blob {
        animation: blob 7s infinite;
    }
    .animation-delay-2000 {
        animation-delay: 2s;
    }

    /* --- NOUVEAU : CSS Étoiles Filantes --- */
    .shooting-star {
        position: absolute;
        left: -150px; /* Départ hors écran à gauche */
        width: 120px;
        height: 2px;
        background: linear-gradient(90deg, rgba(0,0,0,0), rgba(255,255,255,0.8));
        filter: drop-shadow(0 0 4px white);
        animation-name: shoot;
        animation-timing-function: linear;
        transform: rotate(-5deg); /* Légère inclinaison */
    }

    @keyframes shoot {
        0% { transform: translateX(0) translateY(0) rotate(-5deg); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateX(120vw) translateY(20px) rotate(-5deg); opacity: 0; }
    }
</style>