import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';

@Module({
  providers: [QuestionsService],
  exports: [QuestionsService], // On exporte le service pour l'utiliser dans GameModule
})
export class QuestionsModule {}