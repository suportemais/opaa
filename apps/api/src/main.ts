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

  app.use((req, res, next) => {
    const headerId = req.headers['x-correlation-id'];
    const correlationId = typeof headerId === 'string' ? headerId : randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  });

  app.use(helmet());
  app.use(cookieParser());
  const baseDomain = corsBaseDomain();
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!baseDomain) return cb(null, true);
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
    .setTitle('OPAA API')
    .setDescription('API do SaaS de pesquisas e satisfação')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
