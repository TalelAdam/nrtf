import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
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

  // Explicitly bind Socket.IO to Fastify's HTTP server
  app.useWebSocketAdapter(new IoAdapter(app));

  // Register Fastify multipart for file uploads (≤ 50 MB)
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  });

  // Global prefix — must match Next.js rewrite: /api/:path* → backend/api/:path*
  app.setGlobalPrefix('api');

  // Global validation + transformation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — allow all origins in dev
  app.enableCors({ origin: true });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('NRTF Backend')
    .setDescription('Re·Tech Fusion — IoT + Document Intelligence API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const preferredPort = parseInt(process.env.PORT ?? '3000', 10);
  const port = await findFreePort(preferredPort);
  if (port !== preferredPort) {
    logger.warn(`Port ${preferredPort} in use — using ${port} instead`);
  }
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);

  // Keep frontend proxy in sync: write resolved port into apps/frontend/.env.local
  try {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const envLocal = path.resolve(__dirname, '../../../../apps/frontend/.env.local');
    const content =
      `BACKEND_URL=http://localhost:${port}\n` +
      `NEXT_PUBLIC_API_URL=http://localhost:${port}/api\n` +
      `NEXT_PUBLIC_WS_URL=ws://localhost:${port}/ws\n`;
    fs.writeFileSync(envLocal, content, 'utf8');
    logger.log(`Updated frontend .env.local → BACKEND_URL=http://localhost:${port}`);
  } catch (_) {
    // non-fatal — next.config.mjs auto-detects anyway
  }
}

/** Try ports sequentially until one succeeds (max 10 attempts). */
function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const net = require('net') as typeof import('net');
    let attempt = start;
    const tryPort = () => {
      const srv = net.createServer();
      srv.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attempt < start + 10) {
          attempt++;
          tryPort();
        } else {
          reject(err);
        }
      });
      srv.once('listening', () => {
        srv.close(() => resolve(attempt));
      });
      srv.listen(attempt, '0.0.0.0');
    };
    tryPort();
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
