import * as dotenv from 'dotenv';
dotenv.config(); 

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); // 0.0.0.0 est vital pour Docker/Render
  console.log(`🚀 Backend NestJS lancé sur le port ${port}`);
}
bootstrap();