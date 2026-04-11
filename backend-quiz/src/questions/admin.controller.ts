import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import sharp from 'sharp';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { QuestionsService } from './questions.service';

@Controller('admin/questions')
export class AdminController {
  private readonly supabase: SupabaseClient;
  private readonly bucketName: string;

  constructor(private readonly questionsService: QuestionsService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
    this.bucketName = process.env.SUPABASE_BUCKET || 'quiz-media';
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async createQuestion(
    @Body() body: {
      question: string;
      answer: string;
      points: string;
      genre: string;
      type: string;
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!body.question?.trim() || !body.answer?.trim()) {
      throw new BadRequestException('Question et réponse obligatoires');
    }

    const type = body.type || 'text';
    if (!['text', 'image', 'opinion', 'drawing'].includes(type)) {
      throw new BadRequestException('Type invalide');
    }

    const points = Math.max(1, Math.min(5, parseInt(body.points) || 1));
    const genre = body.genre?.trim() || 'Général';

    let mediaUrl: string | null = null;

    // Process image upload
    if (type === 'image') {
      if (!file) {
        throw new BadRequestException('Image requise pour les questions de type image');
      }
      mediaUrl = await this.processAndUploadImage(file);
    }

    // Insert into DB
    const { data, error } = await this.supabase
      .from('questions')
      .insert({
        question: body.question.trim(),
        answer: body.answer.trim(),
        points,
        genre,
        type,
        media_url: mediaUrl,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Erreur DB: ${error.message}`);
    }

    return { success: true, question: data };
  }

  @Get()
  async listQuestions() {
    const { data, error } = await this.supabase
      .from('questions')
      .select('id, question, answer, points, genre, type, media_url, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new BadRequestException(`Erreur DB: ${error.message}`);
    }

    return data || [];
  }

  @Get('genres')
  async getGenres() {
    const genres = await this.questionsService.fetchDistinctGenres();
    return genres;
  }

  @Delete(':id')
  async deleteQuestion(@Param('id') id: string) {
    // Get question first to delete image if needed
    const { data: question } = await this.supabase
      .from('questions')
      .select('media_url, type')
      .eq('id', id)
      .single();

    if (question?.type === 'image' && question?.media_url && !question.media_url.startsWith('http')) {
      await this.supabase.storage.from(this.bucketName).remove([question.media_url]);
    }

    const { error } = await this.supabase.from('questions').delete().eq('id', id);
    if (error) {
      throw new BadRequestException(`Erreur: ${error.message}`);
    }

    return { success: true };
  }

  private async processAndUploadImage(file: Express.Multer.File): Promise<string> {
    // Convert to WebP 800px wide, quality 80
    const webpBuffer = await sharp(file.buffer)
      .resize(800, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = `questions/${uuidv4()}.webp`;

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filename, webpBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year cache
      });

    if (error) {
      throw new BadRequestException(`Erreur upload: ${error.message}`);
    }

    return filename;
  }
}
