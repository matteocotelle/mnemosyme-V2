import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Question } from './questions.interfaces';

@Injectable()
export class QuestionsService {
  private readonly supabase: SupabaseClient;
  private readonly bucketName: string;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
    this.bucketName = process.env.SUPABASE_BUCKET || 'quiz-media';
  }

  /**
   * Fetch random questions with optional category filter and exclusion list.
   * Uses a Postgres function for efficient random selection.
   */
  async fetchRandomQuestions(
    count: number = 10,
    categories: string[] = [],
    excludeIds: string[] = [],
  ): Promise<Question[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_random_questions', {
        p_count: count,
        p_genres: categories.length > 0 ? categories : null,
        p_exclude_ids: excludeIds.length > 0 ? excludeIds : null,
      });

      if (error) {
        console.error('Erreur Supabase RPC:', error.message);
        return this.fallbackFetch(count, categories, excludeIds);
      }

      return this.enrichWithImages(data || []);
    } catch (error) {
      console.error('Erreur fetchRandomQuestions:', error);
      return [];
    }
  }

  /**
   * Fetch distinct genre values for category selection.
   */
  async fetchDistinctGenres(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_distinct_genres');

      if (error) {
        console.error('Erreur fetchDistinctGenres:', error.message);
        // Fallback: query distinct genres directly
        const { data: fallbackData } = await this.supabase
          .from('questions')
          .select('genre')
          .order('genre');

        if (fallbackData) {
          const genres = new Set(fallbackData.map((r: any) => r.genre));
          return Array.from(genres);
        }
        return [];
      }

      return (data || []).map((r: any) => r.genre);
    } catch (error) {
      console.error('Erreur fetchDistinctGenres:', error);
      return [];
    }
  }

  // --- Private helpers ---

  /**
   * Fallback if the RPC function doesn't exist yet.
   */
  private async fallbackFetch(
    count: number,
    categories: string[],
    excludeIds: string[],
  ): Promise<Question[]> {
    let query = this.supabase.from('questions').select('*');

    if (categories.length > 0) {
      query = query.in('genre', categories);
    }

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    // Fetch more than needed to allow random selection after filtering
    const { data, error } = await query.limit(count * 5);

    if (error || !data) {
      console.error('Erreur fallback fetch:', error?.message);
      return [];
    }

    // Shuffle and take count
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }

    return this.enrichWithImages(data.slice(0, count));
  }

  /**
   * For image-type questions, generate public URLs from Supabase Storage.
   */
  private enrichWithImages(questions: any[]): Question[] {
    return questions.map(q => {
      const question: Question = {
        id: q.id,
        question: q.question,
        answer: q.answer,
        points: q.points || 1,
        genre: q.genre || 'Général',
        type: q.type || 'text',
        mediaUrl: q.media_url,
      };

      // Generate public URL for image questions
      if (question.type === 'image' && question.mediaUrl) {
        if (question.mediaUrl.startsWith('http')) {
          question.image = question.mediaUrl;
        } else {
          const { data } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(question.mediaUrl);
          question.image = data.publicUrl;
        }
      }

      return question;
    });
  }
}
