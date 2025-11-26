// src/lib/types.ts

export interface Answer {
    text: string;
    id: number;
}

export interface Player {
    score: any;
    socketId: string;
    name: string;
    isCreator?: boolean; // On ajoutera cette propriété côté front pour simplifier l'affichage
}

export interface Question {
    id: string;
    text: string;
    answers: string[];
    image?: string;
    type?: 'text' | 'image' | 'drawing';
}

export interface GameState {
    creatorSocketId: any;
    status: 'lobby' | 'playing' | 'result';
    currentQuestion: Question | null;
    timer: number;
    players: Player[];
    roomCode: string;
    myPseudo: string;
    isCreator: boolean;
    leaderboard?: Player[];
}