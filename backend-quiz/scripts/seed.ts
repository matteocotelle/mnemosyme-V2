// scripts/seed.ts
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';

// Charger les variables d'environnement
dotenv.config();

const DATA_FILE = path.join(__dirname, '../seeds/data.json');
const IMAGES_DIR = path.join(__dirname, '../seeds/images');

// Config AWS
const awsConfig = {
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
};

const dbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dbClient);
const s3Client = new S3Client(awsConfig);

const TABLE_NAME = process.env.QUESTIONS_TABLE || 'QuestionsQuiz';
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'mnemosyne-assets';

async function uploadImageToS3(filename: string): Promise<string | null> {
    try {
        const filePath = path.join(IMAGES_DIR, filename);
        if (!fs.existsSync(filePath)) {
            console.error(`⚠️ Image non trouvée : ${filename}`);
            return null;
        }

        const fileContent = fs.readFileSync(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        
        // On organise les images dans un dossier "imported/" sur S3
        const key = `imported/${filename}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: contentType
        }));

        console.log(`✅ Image uploadée : ${key}`);
        return key; // C'est ça qu'on stockera dans mediaUrl
    } catch (error) {
        console.error(`❌ Erreur upload S3 (${filename}):`, error);
        return null;
    }
}

async function seed() {
    console.log("🚀 Démarrage de l'import...");

    if (!fs.existsSync(DATA_FILE)) {
        console.error("Fichier data.json introuvable !");
        return;
    }

    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const questions = JSON.parse(rawData);

    console.log(`${questions.length} questions trouvées.`);

    for (const q of questions) {
        let mediaUrl = "";
        
        // 1. Gestion de l'image
        if (q.imageFile) {
            const s3Key = await uploadImageToS3(q.imageFile);
            if (s3Key) {
                mediaUrl = s3Key;
            }
        }

        // 2. Préparation de l'item DynamoDB
        const newItem = {
            id: uuidv4(),
            question: q.question,
            answer: q.answer,
            points: q.points || 1,
            genre: q.genre || "Général",
            type: mediaUrl ? "image" : "text", // On force le type si image présente
            mediaUrl: mediaUrl || "", // Vide si pas d'image
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // 3. Insertion
        try {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: newItem
            }));
            process.stdout.write("."); // Barre de progression minimaliste
        } catch (error) {
            console.error(`\n❌ Erreur insertion DynamoDB pour "${q.question}":`, error);
        }
    }

    console.log("\n\n✨ Import terminé !");
}

seed();