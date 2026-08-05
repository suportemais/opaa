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
      const candidates = ['/public/caddy/ask'];
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

    const rawPath = typeof (req as any).rawPath === 'string' ? (req as any).rawPath : null;
    const isAskRoute =
      typeof req.url === 'string' &&
      (req.url === '/public/caddy/ask' || req.url.startsWith('/public/caddy/ask?') || req.url.startsWith('/public/caddy/ask/'));
    const isAskRouteOriginal =
      typeof (req as any).originalUrl === 'string' &&
      ((req as any).originalUrl === '/public/caddy/ask' ||
        (req as any).originalUrl.startsWith('/public/caddy/ask?') ||
        (req as any).originalUrl.startsWith('/public/caddy/ask/'));

    if (basePath && (isAskRoute || isAskRouteOriginal || rawPath === '/public/caddy/ask')) {
      const query = (req.query as Record<string, unknown>) || {};
      const domain =
        typeof query.domain === 'string' && query.domain.trim()
          ? query.domain
          : typeof (req as any).rawQuery === 'string' && (req as any).rawQuery.length > 0
            ? Object.fromEntries(new URLSearchParams((req as any).rawQuery)).domain ?? undefined
            : undefined;
      Promise.resolve()
        .then(async () => {
          if (!domain) {
            res.statusCode = 403;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ message: 'Forbidden', error: 'Forbidden', statusCode: 403 }));
            return;
          }
          const { PrismaPg } = await import('@prisma/adapter-pg');
          const { PrismaClient } = await import('@prisma/client');
          const { baseDomain: baseDomainFn, tenantSlugFromHost } = await import('./common/tenant-host.js');
          const connectionString = process.env.DATABASE_URL ?? '';
          if (!connectionString) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ message: 'Internal Server Error', error: 'Internal Server Error', statusCode: 500 }));
            return;
          }
          const adapter = new PrismaPg({ connectionString });
          const prisma = new PrismaClient({ adapter });
          try {
            const base = baseDomainFn();
            if (!base) {
              res.statusCode = 403;
              res.setHeader('content-type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ message: 'Forbidden', error: 'Forbidden', statusCode: 403 }));
              return;
            }
            const normalized = domain.toLowerCase().replace(/:\d+$/, '');
            let ok = false;
            if (normalized === base) {
              ok = true;
            } else {
              const slug = tenantSlugFromHost(normalized, base);
              if (slug) {
                const tenant = await (prisma as any).tenant.findUnique({ where: { slug }, select: { id: true } });
                ok = Boolean(tenant);
              }
            }
            if (!ok) {
              res.statusCode = 403;
              res.setHeader('content-type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ message: 'Forbidden', error: 'Forbidden', statusCode: 403 }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: true }));
          } finally {
            try {
              await (prisma as any).$disconnect();
            } catch {}
          }
        })
        .catch(() => {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ message: 'Internal Server Error', error: 'Internal Server Error', statusCode: 500 }));
        });
      return;
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
