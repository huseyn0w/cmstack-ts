import 'reflect-metadata';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseEnv } from '@typress/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const env = parseEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Only the web app's origin may call the API from the browser.
  app.enableCors({ origin: env.WEB_ORIGIN });

  // Serve uploaded media. `nosniff` stops browsers from reinterpreting a file as
  // a different (e.g. executable) type than its declared content type.
  app.useStaticAssets(resolve(env.UPLOAD_DIR), {
    prefix: '/uploads',
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  await app.listen(env.API_PORT, '0.0.0.0');
  console.log(`Typress API listening on http://localhost:${env.API_PORT}`);
}

bootstrap();
