# MNEMOSYME V2 — REDESIGN COMPLET UI/UX

> Brief autonome pour refonte totale du frontend. A executer en une seule session.
> Ne touche PAS au backend (backend-quiz/) sauf si tu as besoin d'ajouter des champs aux events socket pour les nouvelles features (chat, avatars, stats).

---

## CONTEXTE

- App de quiz multijoueur temps reel (Svelte 5 + Socket.io)
- Public : amis, 20-30 ans, usage 95% mobile
- Le createur de partie utilise aussi son telephone
- UI actuelle : dark glassmorphism indigo/pink = trop "AI generated", a jeter completement
- Objectif : identite visuelle unique, moderne, fluide, mobile-first

---

## 1. DIRECTION ARTISTIQUE

### Palette de couleurs : "Electric Sunset"

Pas de vert. Pas d'indigo/pink/violet actuel. Palette chaleureuse et energique :

| Role | Nom | Hex | Usage |
|------|-----|-----|-------|
| Background | Deep Navy | `#141726` | Fond principal des pages |
| Surface | Muted Navy | `#1E2237` | Cards, surfaces elevees |
| Surface Light | Soft Navy | `#262B44` | Inputs, hover states |
| Primary | Hot Coral | `#FF5E5B` | Boutons principaux, CTA, accents forts |
| Secondary | Mango Yellow | `#FFCD38` | Scores, celebrations, badges winner |
| Accent | Sky Blue | `#48BFE3` | Liens, infos, indicateurs secondaires |
| Text Primary | Near White | `#F0F0F5` | Texte principal |
| Text Muted | Cool Gray | `#8B8CA0` | Labels, hints, texte secondaire |
| Success | Emerald | `#34D399` | Reponses correctes |
| Error | Soft Red | `#F87171` | Reponses incorrectes, erreurs |

Remplacer integralement les couleurs `brand.*` dans tailwind.config.ts par cette nouvelle palette.

### Typographie

**2 Google Fonts :**
- **Headings** : `Space Grotesk` (weights: 500, 600, 700) — geometrique avec du caractere
- **Body** : `Inter` (weights: 400, 500, 600) — lisibilite optimale sur ecran

Importer via `<link>` dans `app.html` ou via `@import` dans `app.css`.
Configurer dans `tailwind.config.ts` :
```
fontFamily: {
  heading: ['Space Grotesk', 'sans-serif'],
  body: ['Inter', 'sans-serif'],
}
```

### Iconographie

**Phosphor Icons** via `phosphor-svelte` (npm install phosphor-svelte).
- Utiliser le weight "bold" pour la navigation et actions
- "regular" pour l'UI generale
- "fill" pour les etats selectionnes
- "duotone" pour les elements decoratifs
- Remplacer TOUS les emojis actuels (crown, lock, rocket, etc.) par des icones Phosphor

### Design Language

- **Cards** : `bg-surface rounded-2xl border border-white/5 shadow-lg` — PAS de glassmorphism/backdrop-blur (trop AI-generated)
- **Boutons primaires** : `bg-primary text-white rounded-xl font-heading font-semibold` — couleur solide, pas de gradient
- **Boutons secondaires** : `bg-surface-light text-text-muted border border-white/10 rounded-xl`
- **Inputs** : `bg-surface border border-white/10 rounded-xl text-white` — focus ring avec primary
- **Pas de blobs flottants**, pas de shooting stars, pas de gradients multi-couleurs
- **Fond** : couleur solide ou tres leger gradient monochrome (ex: du navy vers un navy legerement plus clair)
- **Separation visuelle** : utiliser elevation (shadow) et bordures subtiles, pas des effets de flou

---

## 2. ANIMATIONS

### Principes
- Fluides, rapides (200-400ms max pour les transitions UI)
- Pas de bounce/elastic sauf celebration (result page)
- GPU-accelerated (transform + opacity uniquement)
- Respecter `prefers-reduced-motion`

### Stack animation
- **Svelte built-in** : `fade`, `fly`, `scale`, `slide` pour 80% des besoins
- **@formkit/auto-animate** (npm install) : listes dynamiques (joueurs lobby, reponses correction)
- **canvas-confetti** (deja installe) : celebration resultats
- NE PAS ajouter de lib supplementaire (pas de GSAP, pas de svelte-motion)

### Animations specifiques par page
- **Home** : Entree douce des elements (fade + leger fly y:20). Pas de decorations animees en boucle
- **Lobby** : auto-animate sur la grille joueurs (entree/sortie fluide). Chat avec slide-in des messages
- **Game** : Question slide-in (fly x:100). Timer bar smooth (transition CSS). Flash subtil quand timer < 5s
- **Correction** : Cards avec auto-animate. Toggle validation avec scale rapide (150ms)
- **Result** : Podium avec sequence temporisee (garder le pattern actuel). Confetti. Leaderboard fly-in

---

## 3. SONS

### Moteur audio
Remplacer le systeme actuel (HTMLAudioElement brut) par **Howler.js** (`npm install howler`, `npm install -D @types/howler`).
Refactorer `src/lib/stores/sound.ts` pour utiliser Howler (gestion mobile, audio sprites, pool).

### Sons a sourcer
Trouver des sons **clean et modernes** (style UI/notification, pas arcade/cartoon) sur Mixkit (https://mixkit.co/free-sound-effects/) ou Pixabay (https://pixabay.com/sound-effects/).
Telecharger en MP3 (leger) dans `/static/sounds/`.

**Sons manquants a ajouter** (les fichiers actuels : click.wav, click1.wav, error.wav — les autres references dans le code n'existent pas) :
- `success.mp3` — chime ascendant court (~300ms)
- `join.mp3` — notification bulle subtile (~200ms)
- `win.mp3` — fanfare courte (~1s)
- `timer-tick.mp3` — tick discret pour les 5 dernieres secondes
- `timer-urgent.mp3` — tick accelere pour les 3 dernieres secondes
- `whoosh.mp3` — transition entre questions (~300ms)
- `send.mp3` — envoi de reponse / message chat (~200ms)

Garder les sons existants si leur qualite est correcte, sinon les remplacer.

### Integration sons par page
- **Home** : click sur boutons, fail sur erreur validation
- **Lobby** : join quand un joueur arrive, click sur boutons, send pour chat
- **Game** : whoosh a chaque nouvelle question, timer-tick les 5 dernieres sec, timer-urgent les 3 dernieres, send a la soumission
- **Correction** : click pour toggle validation, success/fail selon le toggle
- **Result** : win au moment du confetti (1ere place)

### Mute toggle
Ajouter un bouton mute visible et accessible sur toutes les pages (dans le layout ou un composant global).
Persister l'etat mute dans localStorage.

---

## 4. AVATARS

### Systeme DiceBear
Installer `@dicebear/core` et `@dicebear/collection` (npm).
Utiliser le style **"adventurer"** pour generer des avatars SVG.

### Implementation
- Creer 12-15 seeds pre-definis qui generent de beaux avatars varies (tester differentes seeds)
- Sur la page Home, apres avoir entre le pseudo, afficher une grille de ~12 avatars a choisir
- L'avatar choisi est stocke dans le gameState store et transmis via socket
- Afficher l'avatar partout ou on avait les initiales (lobby, correction, result)

### Modifications backend necessaires
- Ajouter un champ `avatar: string` (le seed) dans l'interface `Player` (backend-quiz/src/game/interfaces/game.interfaces.ts)
- Passer `avatar` dans les events `createRoom`, `joinRoom`
- Inclure `avatar` dans les broadcasts `roomData`, `correctionState`, `correctionFinished`
- Mettre a jour le type `Player` cote frontend (`src/lib/type.ts`)

---

## 5. CHAT LOBBY

### Fonctionnalite
- Chat textuel simple dans le lobby (pas de reactions, pas de formatage)
- Zone de chat en bas de page lobby, au-dessus des boutons d'action
- Messages limites a 200 caracteres
- Afficher : avatar miniature + pseudo + message + timestamp relatif
- Auto-scroll vers le bas a chaque nouveau message
- Pas de persistance (messages perdus si on quitte)

### Implementation socket
**Backend** — ajouter dans game.gateway.ts :
```typescript
@SubscribeMessage('chatMessage')
handleChatMessage(
  @MessageBody() data: { roomId: string, message: string },
  @ConnectedSocket() client: Socket
) {
  const room = this.gameService.getRoom(data.roomId);
  if (!room || room.status !== 'lobby') return;
  const player = room.players.find(p => p.socketId === client.id);
  if (!player) return;
  this.server.to(data.roomId).emit('newChatMessage', {
    pseudo: player.name,
    avatar: player.avatar,
    message: data.message.slice(0, 200),
    timestamp: Date.now()
  });
}
```

**Frontend** — ecouter `newChatMessage` dans lobby/+page.svelte, stocker dans un array local.

---

## 6. PAGES — SPECIFICATIONS DETAILLEES

### 6.1 Layout Global (`+layout.svelte`)
- Fond : `bg-[#141726]` sur tout le body
- Font par defaut : font-body (Inter)
- Composant global : bouton mute (coin superieur droit, fixe, discret)
- Transition entre pages : crossfade ou fade rapide (200ms)
- Meta viewport pour mobile

### 6.2 Home (`/`)
**Structure mobile-first :**
```
[Logo/Titre "Mnemosyme" — font-heading, text-3xl, couleur primary]
[Sous-titre — text-muted, text-sm]

[Card principale — bg-surface, rounded-2xl, p-6]
  [Input Pseudo — pleine largeur]
  [Grille Avatars — 4 colonnes, scrollable horizontalement si besoin]
  [Separateur "ou rejoindre"]
  [Input Code Salon]
  [Bouton "Rejoindre" — primary, pleine largeur]
  [Bouton "Creer un salon" — secondary, pleine largeur]
  [Message d'erreur si besoin]
```

- Supprimer : shooting stars, blobs, glassmorphism, animate-float sur le titre
- Le titre doit etre simple et propre, pas de gradient text
- Les boutons doivent etre grands et tactiles (min 48px height)
- Selector d'avatar : grille de 12 avatars DiceBear, le selectionne a un ring primary
- Si `?code=` dans l'URL : pre-remplir le code, focus sur pseudo, mettre en avant "Rejoindre"

### 6.3 Lobby (`/lobby`)
**Structure mobile-first :**
```
[Header — Code salon + bouton copier lien]

[Grille joueurs — 2 colonnes sur mobile, gap-3]
  [Card joueur : Avatar DiceBear + Pseudo + Badge createur + Badge "(Toi)"]
  [Slots vides en pointilles si < 4 joueurs]

[Section Chat — hauteur fixe ~200px, scrollable]
  [Messages : mini avatar + pseudo + texte]
  [Input chat + bouton envoyer]

[Footer fixe]
  [Bouton "Lancer la partie" (createur) OU message d'attente]
  [Bouton "Quitter" — text discret]
```

- Garder auto-animate pour la grille joueurs
- Chat = nouveau composant ou section integree dans la page
- Bouton copier : icone Phosphor (Copy) avec feedback "Copie !" temporaire

### 6.4 Game (`/game`)
**Structure mobile-first :**
```
[Header fixe — sticky top]
  [Indicateur "EN DIRECT" avec dot pulse]
  [Question X / Total]
  [Pseudo joueur]

[Timer bar — sous le header, pleine largeur]
  [Barre de progression, change de couleur primary -> error quand < 30%]

[Contenu principal — centre vertical]
  [Texte question — font-heading, text-2xl mobile / text-4xl desktop]
  [Image si presente — rounded, shadow]
  [Input reponse — grand, centre, autofocus]
  [OU etat "Reponse verrouillee" avec icone Lock]
  [Hint "La reponse sera envoyee a la fin du chrono"]
```

- Garder le flow actuel (fonctionne bien)
- Question transition : fly depuis la droite (x:100, 400ms)
- Timer : ajouter sons tick pour les 5 dernieres sec
- Supprimer les blobs de fond
- Input : style clean, pas de emoji hourglass

### 6.5 Correction (`/correction`)
**Structure mobile-first :**
```
[Header — "Correction" + Question X / Total]

[Card Question]
  [Texte question]
  [Image si presente]
  [Bonne reponse — badge success avec icone Check]
  [Points — badge secondary]

[Liste reponses joueurs — auto-animate]
  [Card par joueur : Avatar + Pseudo + Reponse + Bouton validation]
    [Si createur : card cliquable, toggle entre correct/incorrect/non-evalue]
    [Si joueur : lecture seule]
    [Indicateur visuel clair : icone CheckCircle (success), XCircle (error), MinusCircle (pending)]

[Footer fixe]
  [Bouton "Suivant" (createur, actif quand tout valide)]
  [OU "En attente..." (joueurs)]
```

**Ameliorations UX correction :**
- Swipe horizontal pour passer a la question suivante (en plus du bouton) — si faisable simplement
- Boutons "Tout valider" / "Tout refuser" en haut de la liste pour accelerer la correction
- Indicateur de progression clair (dots ou barre) pour voir combien de questions restent
- Animation de toggle rapide (scale 0.95 -> 1, 150ms) avec changement de couleur instantane

### Modifications backend pour "Tout valider" / "Tout refuser" :
Ajouter dans game.gateway.ts :
```typescript
@SubscribeMessage('validateAll')
handleValidateAll(
  @MessageBody() data: { roomId: string, isCorrect: boolean },
  @ConnectedSocket() client: Socket
) {
  // Appeler toggleValidation pour chaque joueur qui n'a pas encore ete evalue
  // ou setter directement dans le service
}
```

Ajouter dans game.service.ts une methode `validateAllPlayers(roomId, isCorrect)`.

### 6.6 Result (`/result`)
**Structure mobile-first :**
```
[Header — "Classement Final" — font-heading, secondary color]

[Podium — flex row meme sur mobile (adapter les tailles)]
  [2eme place — hauteur moyenne, accent color]
  [1ere place — plus grand, secondary (gold), couronne icone]
  [3eme place — plus petit, muted]

[Stats rapides (NOUVEAU)]
  [Meilleur score]
  [Nombre de bonnes reponses du winner]
  [Question la plus ratee]

[Leaderboard complet — liste avec rank, avatar, pseudo, score]

[Footer fixe]
  [Bouton "Rejouer" (createur) — primary]
  [Bouton "Quitter" — text muted]
```

**Stats a calculer cote backend** :
Modifier `correctionFinished` event pour inclure :
```typescript
{
  leaderboard: Player[],
  stats: {
    totalQuestions: number,
    winnerCorrectAnswers: number,    // nombre de bonnes reponses du 1er
    hardestQuestion: string,          // texte de la question la plus ratee
    hardestQuestionCorrectRate: number, // % de bonnes reponses sur cette question
    perfectScorers: string[],         // joueurs avec score parfait (si applicable)
  }
}
```

Calculer ces stats dans `game.service.ts` avant d'emettre `correctionFinished`.

---

## 7. FICHIERS A MODIFIER/CREER

### Frontend — Fichiers existants a modifier
1. `tailwind.config.ts` — Nouvelle palette, fonts, animations custom
2. `src/app.css` — Import Google Fonts, reset styles, classes utilitaires globales
3. `src/app.html` — Si besoin pour Google Fonts link
4. `src/routes/+layout.svelte` — Layout global, bouton mute, transition pages
5. `src/routes/+page.svelte` — Home complete rewrite
6. `src/routes/lobby/+page.svelte` — Lobby rewrite + chat + avatars
7. `src/routes/game/+page.svelte` — Game rewrite visuel (garder logique)
8. `src/routes/correction/+page.svelte` — Correction rewrite + ameliorations UX
9. `src/routes/result/+page.svelte` — Result rewrite + stats
10. `src/lib/stores/sound.ts` — Refactor vers Howler.js
11. `src/lib/stores/gameState.ts` — Ajouter avatar dans le state
12. `src/lib/type.ts` — Ajouter avatar, stats types

### Frontend — Nouveaux fichiers potentiels
- `src/lib/components/Avatar.svelte` — Composant avatar DiceBear reutilisable
- `src/lib/components/AvatarPicker.svelte` — Grille selection avatar
- `src/lib/components/MuteButton.svelte` — Bouton mute global
- `src/lib/components/Chat.svelte` — Chat du lobby (optionnel, peut etre inline)
- `src/lib/avatars.ts` — Seeds pre-definis pour les avatars

### Backend — Fichiers a modifier
1. `backend-quiz/src/game/interfaces/game.interfaces.ts` — Ajouter `avatar` a Player
2. `backend-quiz/src/game/game.gateway.ts` — Chat event, validateAll event, passer avatar
3. `backend-quiz/src/game/game.service.ts` — Stats calculation, validateAll, avatar handling

### Packages a installer
**Frontend (depuis root) :**
```bash
npm install phosphor-svelte @dicebear/core @dicebear/collection howler @formkit/auto-animate
npm install -D @types/howler
```

**Backend (depuis backend-quiz/) :**
Aucun nouveau package necessaire.

---

## 8. CONTRAINTES & REGLES

1. **Mobile-first** : Tout doit etre parfait sur mobile (375px+). Desktop = fonctionnel mais pas prioritaire
2. **Performance** : Pas de lib lourde. Lazy-load les sons. Tree-shake les icones Phosphor
3. **Pas de design "AI generated"** : Pas de glassmorphism, pas de gradients multi-couleurs, pas de blobs flottants, pas de neon glow
4. **Langue** : Tout le texte UI reste en francais
5. **Flow** : Ne pas changer le flow utilisateur (Home -> Lobby -> Game -> Correction -> Result -> Lobby/Home)
6. **Socket events** : Garder la compatibilite avec les events existants. Les nouveaux events (chat, validateAll) sont additifs
7. **Svelte 5** : Tu peux moderniser vers les runes ($state, $derived, $effect) si ca simplifie le code, mais ce n'est pas obligatoire
8. **Dark mode only** : Pas de light mode
9. **Tester** : Apres chaque page modifiee, verifier que `npm run check` passe (depuis root)
10. **Commits** : Ne fais PAS de commits. Je review d'abord

---

## 9. ORDRE D'EXECUTION RECOMMANDE

1. **Setup** : Installer packages, configurer tailwind, fonts, app.css
2. **Composants** : Creer Avatar, AvatarPicker, MuteButton
3. **Sound store** : Refactorer avec Howler.js
4. **Types** : Mettre a jour les interfaces (front + back)
5. **Backend** : Ajouter chat, validateAll, stats, avatar dans les events
6. **Home** : Redesign complet
7. **Lobby** : Redesign + chat + avatars
8. **Game** : Redesign visuel
9. **Correction** : Redesign + ameliorations UX
10. **Result** : Redesign + stats
11. **Layout** : Transitions, mute button global
12. **Sons** : Telecharger/creer les sons manquants, integrer dans chaque page
13. **Polish** : Verifier mobile, animations, coherence visuelle

---

## 10. REFERENCE VISUELLE

S'inspirer de l'energie de **Quizizz** (fun, colore, dynamique) mais avec une identite propre :
- Plus mature (pas enfantin)
- Plus epure (moins de decorations)
- Couleurs chaudes (coral/gold vs le violet de Quizizz)
- Typographie forte (Space Grotesk donne du caractere)

Le resultat doit donner l'impression d'une app faite par un vrai designer, pas generee par une IA.
