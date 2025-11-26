import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'; // Nouveaux imports
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';   // Nouveau import

@Injectable()
export class QuestionsService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly s3Client: S3Client; // Client S3
  private readonly tableName = process.env.QUESTIONS_TABLE || 'QuestionsQuiz';
  private readonly bucketName = process.env.AWS_BUCKET_NAME || 'quiz-app-media-7730-7944-5629'; // Ajoute ça dans ton .env

  constructor() {
    // Configuration commune (utilise les credentials du .env automatiquement)
    const awsConfig = {
        region: process.env.AWS_REGION || 'eu-north-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
        }
    };

    const dbClient = new DynamoDBClient(awsConfig); 
    this.docClient = DynamoDBDocumentClient.from(dbClient);
    
    // Initialisation S3
    this.s3Client = new S3Client(awsConfig);
  }

  async fetchRandomQuestions(count: number = 20) {
    try {
      const command = new ScanCommand({ TableName: this.tableName });
      const response = await this.docClient.send(command);
      
      let items = response.Items || [];
      
      // Mélange (Fisher-Yates)
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      
      const selectedQuestions = items.slice(0, count);

      // --- MAGIE ICI : On enrichit les questions avec les URLs signées ---
      const enrichedQuestions = await Promise.all(selectedQuestions.map(async (q) => {
        // Si c'est une question image et qu'on a une clé dans mediaUrl
        if (q.type === 'image' && q.mediaUrl) {
            try {
                // On génère une URL temporaire valide 1 heure (3600s)
                const command = new GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: q.mediaUrl,
                });
                const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
                
                // On remplace la clé par l'URL complète pour le front
                return { ...q, image: signedUrl }; 
            } catch (err) {
                console.error(`Erreur S3 pour ${q.mediaUrl}:`, err);
                return q; // On renvoie la question sans image en cas d'erreur
            }
        }
        return q;
      }));

      return enrichedQuestions;

    } catch (error) {
      console.error('Erreur DynamoDB:', error);
      return [];
    }
  }
}