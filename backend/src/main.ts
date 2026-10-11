import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { TransformInterceptor } from './modules/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './modules/common/filters/http-exception.filter';

async function bootstrap() {
  if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) throw new Error('JWT_SECRET and DATABASE_URL are required.');
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) throw new Error('Production JWT_SECRET must contain at least 32 characters.');
  const app = await NestFactory.create(AppModule);

  // Cookie parser middleware for session_token
  app.use(cookieParser());

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
      : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-webhook-secret'],
  });

  // Prefix config for API routing: /api
  app.setGlobalPrefix('api');

  // Setting for validation input of DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Standard response envelopes & error formatting
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('GDGoC FPTU HCMC Portal — API Contract')
    .setDescription('Internal Platform & Management API for GDGoC FPTU HCMC')
    .setVersion('1.1')
    .addBearerAuth()
    .addCookieAuth('session_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(
    `Swagger API Docs available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
