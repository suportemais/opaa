import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';

function corsBaseDomain() {
  const base = (process.env.APP_BASE_DOMAIN ?? '').trim().toLowerCase();
  if (base) return base;
  const baseUrl = (process.env.APP_BASE_URL ?? '').trim();
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpAdapter = app.getHttpAdapter();

  const basePath = (process.env.API_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (basePath) app.setGlobalPrefix(`/${basePath}`);

  app.use((req, res, next) => {
    const headerId = req.headers['x-correlation-id'];
    const correlationId = typeof headerId === 'string' ? headerId : randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    if (basePath) {
      const p = `/${basePath}`;
      const publicPathsNoPrefix = ['/public/caddy/ask'];
      const candidates = publicPathsNoPrefix;
      for (const candidate of candidates) {
        if (typeof req.url === 'string' && req.url.startsWith(p)) {
          const rest = req.url.slice(p.length);
          if (rest === candidate || rest.startsWith(`${candidate}?`) || rest.startsWith(`${candidate}/`)) {
            req.url = rest;
          }
        }
        if (typeof (req as any).originalUrl === 'string' && (req as any).originalUrl.startsWith(p)) {
          const rest = (req as any).originalUrl.slice(p.length);
          if (rest === candidate || rest.startsWith(`${candidate}?`) || rest.startsWith(`${candidate}/`)) {
            (req as any).originalUrl = rest;
          }
        }
      }
    }

    next();
  });

  const instance = httpAdapter.getInstance();
  if (instance && typeof instance.set === 'function') instance.set('trust proxy', true);
  app.use(helmet());
  app.use(cookieParser());

  const baseDomain = corsBaseDomain();
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!baseDomain) return cb(null, false);
      try {
        const hostname = new URL(origin).hostname.toLowerCase();
        if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) return cb(null, true);
      } catch {}
      return cb(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Opiina API')
    .setDescription('API do SaaS Opiina (pesquisas/NPS e central de feedbacks)')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(basePath ? `${basePath}/docs` : 'docs', app, document);

  app.enableShutdownHooks();

  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
