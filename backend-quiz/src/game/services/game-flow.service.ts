import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { Server } from 'socket.io';
import { Room } from '../interfaces/game.interfaces';
import { QuestionsService } from '../../questions/questions.service';
import { RoomService } from './room.service';
import { CorrectionService } from './correction.service';
import {
  QUESTION_TRANSITION_DELAY_MS,
  ANTI_CHEAT_GRACE_MS,
} from '../game.constants';
import type { NewQuestionEvent, TimerSyncEvent } from '../interfaces/events.interfaces';

@Injectable()
export class GameFlowService {
  public server: Server;

  constructor(
    private readonly questionsService: QuestionsService,
    private readonly roomService: RoomService,
    @Inject(forwardRef(() => CorrectionService))
    private readonly correctionService: CorrectionService,
  ) {}

  async startGame(roomId: string): Promise<void> {
    const room = this.roomService.getRoom(roomId);
    if (!room || room.phase !== 'lobby') return;

    const excludeIds = room.settings.noRepeat ? room.previousQuestionIds : [];
    const questions = await this.questionsService.fetchRandomQuestions(
      room.settings.questionCount,
      room.settings.categories,
      excludeIds,
    );

    if (questions.length === 0) {
      this.server.to(roomId).emit('errorMsg', 'Pas assez de questions disponibles');
      return;
    }

    room.questions = questions;
    room.phase = 'playing';
    room.currentQuestionIndex = 0;
    room.answers = [];
    room.validatedAnswers = new Map();
    room.opinionResults = new Map();
    room.correctionQuestionIndex = 0;
    room.tripleQuestionIndices = this.pickTripleIndices(questions.length);
    room.players.forEach(p => {
      p.score = 0;
      p.streak = { current: 0, max: 0 };
    });
    this.roomService.touchRoom(room);

    this.server.to(roomId).emit('gameStarted');

    setTimeout(() => this.sendNextQuestion(roomId), QUESTION_TRANSITION_DELAY_MS);
  }

  submitAnswer(roomId: string, socketId: string, answer: string, questionIndex: number): void {
    const room = this.roomService.getRoom(roomId);
    if (!room || room.phase !== 'playing') return;

    // Anti-cheat: reject stale question index
    if (questionIndex !== room.currentQuestionIndex) return;

    // Anti-cheat: reject if timer expired (with grace period)
    const elapsed = Date.now() - room.timer.questionStartedAt;
    if (elapsed > room.timer.durationMs + ANTI_CHEAT_GRACE_MS) return;

    // Reject duplicate answer
    const alreadyAnswered = room.answers.some(
      a => a.socketId === socketId && a.questionIndex === questionIndex,
    );
    if (alreadyAnswered) return;

    // For opinion questions, validate that the answer is one of the choices
    const question = room.questions[room.currentQuestionIndex];
    if (question?.type === 'opinion') {
      const choices = question.answer.split('|').map(c => c.trim());
      if (!choices.includes(answer)) return; // invalid choice
    }

    room.answers.push({
      questionIndex,
      socketId,
      answer,
      submittedAt: Date.now(),
    });

    this.roomService.touchRoom(room);
  }

  // --- Get current question state (for reconnection) ---

  getCurrentQuestionEvent(room: Room): NewQuestionEvent | null {
    if (room.phase !== 'playing') return null;
    const q = room.questions[room.currentQuestionIndex];
    if (!q) return null;

    return this.buildQuestionPayload(room, q);
  }

  getRemainingMs(room: Room): number {
    if (!room.timer.questionStartedAt) return 0;
    const elapsed = Date.now() - room.timer.questionStartedAt;
    return Math.max(0, room.timer.durationMs - elapsed);
  }

  // --- Private: question flow ---

  private buildQuestionPayload(room: Room, q: any): NewQuestionEvent {
    const isTriple = room.tripleQuestionIndices.includes(room.currentQuestionIndex);

    const payload: NewQuestionEvent = {
      index: room.currentQuestionIndex,
      total: room.questions.length,
      text: q.question,
      image: q.image || null,
      seconds: room.settings.timerSeconds,
      type: q.type || 'text',
      isTriple,
    };

    if (q.type === 'opinion') {
      const choices = q.answer.split('|').map((c: string) => c.trim());
      payload.choices = [choices[0], choices[1]];
    }

    // Prefetch: send next question's image if available
    const nextQ = room.questions[room.currentQuestionIndex + 1];
    if (nextQ?.image) {
      payload.nextImage = nextQ.image;
    }

    return payload;
  }

  private sendNextQuestion(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (!room || room.phase !== 'playing') return;

    if (room.currentQuestionIndex >= room.questions.length) {
      this.endGame(roomId);
      return;
    }

    const q = room.questions[room.currentQuestionIndex];
    const payload = this.buildQuestionPayload(room, q);

    this.server.to(roomId).emit('newQuestion', payload);
    this.startTimer(room);
  }

  private startTimer(room: Room): void {
    const durationMs = room.settings.timerSeconds * 1000;
    room.timer = {
      intervalRef: null,
      questionStartedAt: Date.now(),
      durationMs,
    };

    room.timer.intervalRef = setInterval(() => {
      const elapsed = Date.now() - room.timer.questionStartedAt;
      const remainingMs = Math.max(0, durationMs - elapsed);

      const sync: TimerSyncEvent = {
        remainingMs,
        questionIndex: room.currentQuestionIndex,
      };
      this.server.to(room.id).emit('timerSync', sync);

      if (remainingMs <= 0) {
        this.clearTimer(room);
        this.onTimerExpired(room);
      }
    }, 1000);
  }

  private onTimerExpired(room: Room): void {
    const question = room.questions[room.currentQuestionIndex];

    // Auto-resolve opinion questions
    if (question?.type === 'opinion') {
      this.resolveOpinionQuestion(room);
    }

    this.closeQuestion(room.id);
  }

  /**
   * For opinion questions: count votes, determine majority, auto-validate.
   * Players who voted with the majority (or on a tie) get points.
   */
  private resolveOpinionQuestion(room: Room): void {
    const qIndex = room.currentQuestionIndex;
    const question = room.questions[qIndex];
    const choices = question.answer.split('|').map((c: string) => c.trim());
    const answersForQ = room.answers.filter(a => a.questionIndex === qIndex);

    // Count votes per choice
    const voteCounts = new Map<string, number>();
    choices.forEach(c => voteCounts.set(c, 0));

    for (const ans of answersForQ) {
      const current = voteCounts.get(ans.answer) || 0;
      voteCounts.set(ans.answer, current + 1);
    }

    const maxVotes = Math.max(...voteCounts.values());
    const isTie = [...voteCounts.values()].filter(v => v === maxVotes).length > 1;

    // Determine winning choice(s)
    const winningChoices = isTie
      ? choices // tie = everyone wins
      : choices.filter(c => (voteCounts.get(c) || 0) === maxVotes);

    // Auto-validate each player
    const points = this.getEffectivePoints(room, qIndex);
    for (const player of room.players) {
      const playerAnswer = answersForQ.find(a => a.socketId === player.socketId);
      const key = `${player.socketId}-${qIndex}`;

      if (playerAnswer && winningChoices.includes(playerAnswer.answer)) {
        room.validatedAnswers.set(key, true);
        player.score += points;
      } else if (playerAnswer) {
        room.validatedAnswers.set(key, false);
      } else {
        // No answer = wrong
        room.validatedAnswers.set(key, false);
      }
    }

    // Store majority result for display during correction
    room.opinionResults.set(qIndex, isTie ? 'TIE' : winningChoices[0]);

    // Recalculate streaks for all players (opinion answers count toward streaks)
    for (const player of room.players) {
      this.correctionService.recalculateStreak(room, player);
    }
  }

  private clearTimer(room: Room): void {
    if (room.timer.intervalRef) {
      clearInterval(room.timer.intervalRef);
      room.timer.intervalRef = null;
    }
  }

  private closeQuestion(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (!room) return;

    setTimeout(() => {
      room.currentQuestionIndex++;
      this.sendNextQuestion(roomId);
    }, QUESTION_TRANSITION_DELAY_MS);
  }

  private endGame(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (!room) return;

    this.clearTimer(room);
    room.phase = 'correction';
    room.correctionQuestionIndex = 0;
    this.server.to(roomId).emit('gameFinished');
  }

  /**
   * Pick which question indices are x3 ("triple").
   * ~12% of questions, minimum 1, never on the very first question.
   */
  private pickTripleIndices(total: number): number[] {
    const count = Math.max(1, Math.round(total * 0.12));
    // Exclude index 0 so the first question is never triple
    const candidates = Array.from({ length: total - 1 }, (_, i) => i + 1);
    // Fisher-Yates partial shuffle
    for (let i = candidates.length - 1; i > 0 && candidates.length - i <= count; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(-count).sort((a, b) => a - b);
  }

  /** Get effective points for a question (base * 3 if triple). */
  getEffectivePoints(room: Room, questionIndex: number): number {
    const base = room.questions[questionIndex]?.points || 1;
    const isTriple = room.tripleQuestionIndices.includes(questionIndex);
    return isTriple ? base * 3 : base;
  }
}
