# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mnemosyme V2 is a real-time multiplayer quiz game. Two independent apps live in one repo:
- **Frontend** (root `src/`): SvelteKit + TailwindCSS + Socket.io-client
- **Backend** (`backend-quiz/`): NestJS + Socket.io + AWS DynamoDB/S3

The project is in French (UI text, commit messages, variable names in some places).

## Commands

### Frontend (run from root)
```bash
npm run dev           # Vite dev server
npm run build         # Production build
npm run check         # svelte-check type validation
```

### Backend (run from `backend-quiz/`)
```bash
npm run start:dev     # Watch mode (nodemon)
npm run build         # NestJS compilation
npm run test          # Jest unit tests
npm run test:e2e      # E2E tests
npm run lint          # ESLint with auto-fix
npm run format        # Prettier formatting
```

## Architecture

### Game Flow (state machine)
Home (create/join room) → Lobby (wait) → Game (timed questions) → Correction (creator validates answers) → Result (leaderboard) → back to Lobby or Home

### Communication
All client-server communication uses **WebSocket only** (no REST endpoints). The gateway is at `backend-quiz/src/game/game.gateway.ts` and dispatches to `game.service.ts` which holds all room/game logic.

### Key architectural patterns
- **Svelte stores** (`src/lib/stores/`) manage socket connection, game state, and sound — these are the source of truth on the frontend
- **Room-based multiplayer**: rooms identified by 5-char codes, one creator per room who controls game flow (start, validate answers, restart)
- **Phantom players**: disconnected players during game/correction are marked as ghosts (not removed), enabling reconnection
- **Creator-driven correction**: the room creator manually validates each player's answer during the correction phase; scores update in real-time per toggle
- **AWS integration**: `questions.service.ts` scans DynamoDB (`QuestionsQuiz` table) for questions and generates S3 pre-signed URLs (1h expiry) for image-based questions

### Environment Variables
- **Backend** (`backend-quiz/.env`): `PORT`, `FRONTEND_URL` (CORS), `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `QUESTIONS_TABLE`, `AWS_BUCKET_NAME`
- **Frontend**: `PUBLIC_BACKEND_URL` (socket server origin, defaults to `http://localhost:3000`)

### Tailwind Theme
Custom brand colors defined in `tailwind.config.ts`: `brand.dark` (slate), `brand.primary` (indigo), `brand.secondary` (pink), `brand.accent` (violet).
