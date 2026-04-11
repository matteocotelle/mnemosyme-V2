import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { Room, Player } from '../interfaces/game.interfaces';
import { RoomService } from './room.service';
import type {
  CorrectionStateEvent,
  CorrectionPlayerData,
  CorrectionFinishedEvent,
  GameStats,
  StreakUpdateEvent,
} from '../interfaces/events.interfaces';

@Injectable()
export class CorrectionService {
  public server: Server;

  constructor(private readonly roomService: RoomService) {}

  /** Get effective points for a question (base * 3 if triple). */
  private getEffectivePoints(room: Room, questionIndex: number): number {
    const base = room.questions[questionIndex]?.points || 1;
    return room.tripleQuestionIndices.includes(questionIndex) ? base * 3 : base;
  }

  sendCorrectionData(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (!room) return;

    const currentQIndex = room.correctionQuestionIndex;

    // All questions corrected → finish
    if (currentQIndex >= room.questions.length) {
      this.finishCorrection(room);
      return;
    }

    const payload = this.buildCorrectionPayload(room);
    this.server.to(roomId).emit('correctionState', payload);
  }

  buildCorrectionPayload(room: Room): CorrectionStateEvent {
    const currentQIndex = room.correctionQuestionIndex;
    const question = room.questions[currentQIndex];
    const answersForQuestion = room.answers.filter(a => a.questionIndex === currentQIndex);
    const isOpinion = question.type === 'opinion';

    const players: CorrectionPlayerData[] = room.players.map(p => {
      const playerAnswer = answersForQuestion.find(a => a.socketId === p.socketId);
      const validationKey = `${p.socketId}-${currentQIndex}`;
      const isValid = room.validatedAnswers.get(validationKey);

      const hasContent = playerAnswer && playerAnswer.answer && playerAnswer.answer.trim().length > 0;

      return {
        socketId: p.socketId,
        name: p.name,
        avatar: p.avatar,
        answer: hasContent ? playerAnswer.answer : '(Pas de réponse)',
        isCorrect: isValid,
        isDisconnected: p.isDisconnected,
      };
    });

    const basePoints = question.points || 1;
    const effectivePoints = this.getEffectivePoints(room, currentQIndex);
    const isTriple = room.tripleQuestionIndices.includes(currentQIndex);

    const payload: CorrectionStateEvent = {
      questionIndex: currentQIndex,
      total: room.questions.length,
      question: {
        text: question.question,
        answer: question.answer,
        image: question.image || null,
        points: basePoints,
        effectivePoints,
        type: question.type || 'text',
        isTriple,
      },
      players,
    };

    // Add opinion-specific data
    if (isOpinion) {
      const choices = question.answer.split('|').map((c: string) => c.trim());
      payload.question.choices = [choices[0], choices[1]];

      const votes = choices.map(choice => ({
        choice,
        count: answersForQuestion.filter(a => a.answer === choice).length,
      }));
      const majorityResult = room.opinionResults.get(currentQIndex);
      payload.opinionResult = {
        majorityChoice: majorityResult || choices[0],
        votes,
        isTie: majorityResult === 'TIE',
      };
    }

    return payload;
  }

  toggleValidation(roomId: string, targetSocketId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (!room || room.phase !== 'correction') return;

    const question = room.questions[room.correctionQuestionIndex];

    // Block manual toggle on opinion questions (auto-resolved)
    if (question?.type === 'opinion') return;

    // Drawing questions: single-winner mode
    if (question?.type === 'drawing') {
      this.toggleDrawingWinner(room, targetSocketId);
      return;
    }

    const key = `${targetSocketId}-${room.correctionQuestionIndex}`;
    const currentVal = room.validatedAnswers.get(key);
    const newVal = currentVal === true ? false : true;
    room.validatedAnswers.set(key, newVal);

    // Update score
    const player = room.players.find(p => p.socketId === targetSocketId);
    if (player) {
      const points = this.getEffectivePoints(room, room.correctionQuestionIndex);
      if (newVal === true) player.score += points;
      else if (currentVal === true) player.score -= points;

      this.recalculateStreak(room, player);
    }

    this.roomService.touchRoom(room);
    this.sendCorrectionData(roomId);
  }

  /**
   * Drawing mode: only one winner. Clicking a player sets them as correct
   * and all others as incorrect. Clicking the same player again deselects.
   */
  private toggleDrawingWinner(room: Room, targetSocketId: string): void {
    const qIndex = room.correctionQuestionIndex;
    const points = this.getEffectivePoints(room, qIndex);
    const currentKey = `${targetSocketId}-${qIndex}`;
    const wasAlreadyWinner = room.validatedAnswers.get(currentKey) === true;

    // Reset all players for this question
    for (const player of room.players) {
      const key = `${player.socketId}-${qIndex}`;
      const prevVal = room.validatedAnswers.get(key);

      // Remove previous score if was correct
      if (prevVal === true) {
        player.score -= points;
      }

      if (wasAlreadyWinner) {
        // Deselect: set all to undefined
        room.validatedAnswers.delete(key);
      } else {
        // Set all to false
        room.validatedAnswers.set(key, false);
      }
    }

    // Set the winner (unless we're deselecting)
    if (!wasAlreadyWinner) {
      room.validatedAnswers.set(currentKey, true);
      const winner = room.players.find(p => p.socketId === targetSocketId);
      if (winner) {
        winner.score += points;
      }
    }

    // Recalculate streaks for all players
    for (const player of room.players) {
      this.recalculateStreak(room, player);
    }

    this.roomService.touchRoom(room);
    this.sendCorrectionData(room.id);
  }

  validateAllPlayers(roomId: string, isCorrect: boolean): void {
    const room = this.roomService.getRoom(roomId);
    if (!room || room.phase !== 'correction') return;

    // Block bulk validation on opinion/drawing questions
    const question = room.questions[room.correctionQuestionIndex];
    if (question?.type === 'opinion' || question?.type === 'drawing') return;

    const currentQIndex = room.correctionQuestionIndex;

    for (const player of room.players) {
      const key = `${player.socketId}-${currentQIndex}`;
      const currentVal = room.validatedAnswers.get(key);

      // Skip already validated players
      if (currentVal !== undefined) continue;

      room.validatedAnswers.set(key, isCorrect);

      if (isCorrect) {
        player.score += this.getEffectivePoints(room, currentQIndex);
      }

      this.recalculateStreak(room, player);
    }

    this.roomService.touchRoom(room);
    this.sendCorrectionData(roomId);
  }

  nextCorrection(roomId: string): void {
    const room = this.roomService.getRoom(roomId);
    if (!room || room.phase !== 'correction') return;

    room.correctionQuestionIndex++;
    this.roomService.touchRoom(room);
    this.sendCorrectionData(roomId);
  }

  // --- Streaks ---

  recalculateStreak(room: Room, player: Player): void {
    let runningStreak = 0;
    let maxStreak = 0;

    for (let i = 0; i <= room.correctionQuestionIndex; i++) {
      const key = `${player.socketId}-${i}`;
      const isCorrect = room.validatedAnswers.get(key);

      if (isCorrect === undefined) {
        // Not yet evaluated — stop counting here
        break;
      }

      if (isCorrect === true) {
        runningStreak++;
        if (runningStreak > maxStreak) maxStreak = runningStreak;
      } else {
        runningStreak = 0;
      }
    }

    const previousStreak = player.streak.current;
    player.streak = { current: runningStreak, max: maxStreak };

    // Emit streak update when notable (≥ 3) or when dropping from a notable streak
    if (runningStreak >= 3 || previousStreak >= 3) {
      const event: StreakUpdateEvent = {
        socketId: player.socketId,
        playerName: player.name,
        currentStreak: runningStreak,
      };
      this.server.to(room.id).emit('streakUpdate', event);
    }
  }

  // --- Build result payload (for reconnection and finish) ---

  buildResultPayload(room: Room): CorrectionFinishedEvent {
    const leaderboard = [...room.players].sort((a, b) => b.score - a.score);
    const stats = this.calculateStats(room);
    return { leaderboard, stats };
  }

  private finishCorrection(room: Room): void {
    room.phase = 'result';
    const payload = this.buildResultPayload(room);
    this.server.to(room.id).emit('correctionFinished', payload);
  }

  private calculateStats(room: Room): GameStats {
    const totalQuestions = room.questions.length;
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    // Winner correct answers
    let winnerCorrectAnswers = 0;
    if (winner) {
      for (let i = 0; i < totalQuestions; i++) {
        const key = `${winner.socketId}-${i}`;
        if (room.validatedAnswers.get(key) === true) winnerCorrectAnswers++;
      }
    }

    // Hardest question
    let hardestQuestion = '';
    let hardestQuestionCorrectRate = 1;

    for (let i = 0; i < totalQuestions; i++) {
      let correct = 0;
      let total = 0;
      for (const player of room.players) {
        const key = `${player.socketId}-${i}`;
        const val = room.validatedAnswers.get(key);
        if (val !== undefined) {
          total++;
          if (val === true) correct++;
        }
      }
      const rate = total > 0 ? correct / total : 1;
      if (rate < hardestQuestionCorrectRate) {
        hardestQuestionCorrectRate = rate;
        hardestQuestion = room.questions[i]?.question || '';
      }
    }

    // Perfect scorers
    const perfectScorers = room.players
      .filter(p => {
        let correctCount = 0;
        for (let i = 0; i < totalQuestions; i++) {
          const key = `${p.socketId}-${i}`;
          if (room.validatedAnswers.get(key) === true) correctCount++;
        }
        return correctCount === totalQuestions;
      })
      .map(p => p.name);

    // Streaks
    const streaks = room.players.map(p => ({
      playerName: p.name,
      maxStreak: p.streak.max,
    }));

    return {
      totalQuestions,
      winnerCorrectAnswers,
      hardestQuestion,
      hardestQuestionCorrectRate: Math.round(hardestQuestionCorrectRate * 100),
      perfectScorers,
      streaks,
    };
  }
}
