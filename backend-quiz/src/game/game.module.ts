import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomService } from './services/room.service';
import { GameFlowService } from './services/game-flow.service';
import { CorrectionService } from './services/correction.service';
import { ReconnectionService } from './services/reconnection.service';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [QuestionsModule],
  providers: [
    GameGateway,
    RoomService,
    GameFlowService,
    CorrectionService,
    ReconnectionService,
  ],
})
export class GameModule {}
