import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { parseEnv } from '@typress/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const env = parseEnv();
  const app = await NestFactory.create(AppModule);

  // Only the web app's origin may call the API from the browser.
  app.enableCors({ origin: env.WEB_ORIGIN });

  await app.listen(env.API_PORT, '0.0.0.0');
  console.log(`Typress API listening on http://localhost:${env.API_PORT}`);
}

bootstrap();
