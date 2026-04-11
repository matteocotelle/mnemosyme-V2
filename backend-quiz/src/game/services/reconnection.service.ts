import { Injectable } from '@nestjs/common';
import { Room } from '../interfaces/game.interfaces';
import { RoomService } from './room.service';
import { GameFlowService } from './game-flow.service';
import { CorrectionService } from './correction.service';
import type { ReconnectionStateEvent, RoomDataEvent } from '../interfaces/events.interfaces';

@Injectable()
export class ReconnectionService {
  constructor(
    private readonly roomService: RoomService,
    private readonly gameFlowService: GameFlowService,
    private readonly correctionService: CorrectionService,
  ) {}

  buildStateSnapshot(room: Room): ReconnectionStateEvent {
    const roomData: RoomDataEvent = {
      roomId: room.id,
      players: room.players,
      creatorSocketId: room.creatorSocketId,
      phase: room.phase,
      settings: room.settings,
    };

    const snapshot: ReconnectionStateEvent = {
      phase: room.phase,
      roomData,
    };

    switch (room.phase) {
      case 'playing': {
        const currentQuestion = this.gameFlowService.getCurrentQuestionEvent(room);
        if (currentQuestion) {
          snapshot.currentQuestion = currentQuestion;
          snapshot.remainingMs = this.gameFlowService.getRemainingMs(room);
        }
        break;
      }
      case 'correction': {
        snapshot.correctionState = this.correctionService.buildCorrectionPayload(room);
        break;
      }
      case 'result': {
        const result = this.correctionService.buildResultPayload(room);
        snapshot.leaderboard = result.leaderboard;
        snapshot.stats = result.stats;
        break;
      }
    }

    return snapshot;
  }
}
