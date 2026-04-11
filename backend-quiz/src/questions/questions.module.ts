import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CategoryCacheService } from './category-cache.service';
import { AdminController } from './admin.controller';

@Module({
  controllers: [AdminController],
  providers: [QuestionsService, CategoryCacheService],
  exports: [QuestionsService, CategoryCacheService],
})
export class QuestionsModule {}
