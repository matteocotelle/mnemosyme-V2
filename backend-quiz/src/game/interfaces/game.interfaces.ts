export interface Player {
  socketId: string;
  name: string;
  score: number;
  isDisconnected?: boolean;
}

export interface PlayerAnswer {
  questionIndex: number;
  socketId: string;
  answer: string;
}

export interface Room {
  id: string;
  creatorSocketId: string;
  players: Player[]; // On utilise un tableau ici pour simplifier l'envoi au front
  status: 'lobby' | 'playing' | 'correction';
  questions: any[];
  currentQuestionIndex: number;
  answers: PlayerAnswer[];     // Un tableau de réponses typées
  timer: NodeJS.Timeout | null;
  correctionQuestionIndex: number; // À quelle question on est dans la correction
  validatedAnswers: Map<string, boolean>;
}