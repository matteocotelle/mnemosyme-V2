import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [QuestionsModule], // On importe le module Questions pour l'utiliser
  providers: [GameGateway, GameService],
})
export class GameModule {}