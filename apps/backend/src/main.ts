import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  // Register Fastify multipart for file uploads (≤ 50 MB)
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  });

  // Global validation + transformation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS for the frontend (Next.js on :3001)
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3001' });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('NRTF Backend')
    .setDescription('Re·Tech Fusion — IoT + Document Intelligence API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
