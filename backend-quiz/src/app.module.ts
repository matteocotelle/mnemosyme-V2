import { Module } from '@nestjs/common';
import { GameModule } from './game/game.module';
import { QuestionsModule } from './questions/questions.module';

@Module({
  imports: [GameModule, QuestionsModule],
})
export class AppModule {}