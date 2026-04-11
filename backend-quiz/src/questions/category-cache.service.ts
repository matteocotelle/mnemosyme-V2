import { Injectable } from '@nestjs/common';
import { QuestionsService } from './questions.service';

@Injectable()
export class CategoryCacheService {
  private categories: string[] = [];
  private lastFetchedAt = 0;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private readonly questionsService: QuestionsService) {}

  async getCategories(): Promise<string[]> {
    const now = Date.now();
    if (this.lastFetchedAt > 0 && now - this.lastFetchedAt < this.CACHE_TTL_MS) {
      return this.categories;
    }

    this.categories = await this.questionsService.fetchDistinctGenres();
    this.lastFetchedAt = now;
    return this.categories;
  }
}
