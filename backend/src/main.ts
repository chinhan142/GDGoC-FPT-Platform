import { configureDatabase } from './config/database';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { TransformInterceptor } from './modules/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './modules/common/filters/http-exception.filter';

async function bootstrap() {
  configureDatabase();
  if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) throw new Error('JWT_SECRET and DATABASE_URL are required.');
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) throw new Error('Production JWT_SECRET must contain at least 32 characters.');
  const app = await NestFactory.create(AppModule);
  const production = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  if (production && !configuredOrigins.length) throw new Error('CORS_ORIGINS must list the public frontend origin in production.');
  for (const origin of configuredOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || (production && parsed.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS must contain exact HTTPS origins without paths.');
    }
  }
  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : ['http://localhost:3000', 'http://localhost:5173'];
  if (production) {
    const frontend = new URL(process.env.APP_FRONTEND_URL || '');
    if (frontend.protocol !== 'https:' || frontend.origin !== process.env.APP_FRONTEND_URL || !allowedOrigins.includes(frontend.origin)) {
      throw new Error('Production APP_FRONTEND_URL must be an allowed HTTPS frontend origin.');
    }
  }
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 2) {
    throw new Error('TRUST_PROXY_HOPS must be 0, 1 or 2.');
  }
  if (proxyHops) app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);

  // Cookie parser middleware for session_token
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    if (production) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin
      && !allowedOrigins.includes(req.headers.origin)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Origin không được phép.' });
      return;
    }
    if (production && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      && req.cookies?.session_token && !req.headers.origin) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Thiếu Origin cho yêu cầu dùng cookie.' });
      return;
    }
    next();
  });

  // CORS configuration
  app.enableCors({
    origin: allowedOrigins,
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

  if (!production) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 8080;
  await app.listen(port);
  Logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
void bootstrap();
