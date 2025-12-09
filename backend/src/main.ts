import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
    index: 'index.html',
  });

  // Enable CORS for frontend only
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      // Only allow frontend URL
      if (origin === frontendUrl) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API Server is running on port ${port}`);
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log(
    `API Key protection: ${process.env.API_KEY ? 'Enabled' : 'Disabled (Development Mode)'}`,
  );
}

void bootstrap();
