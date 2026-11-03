import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const porta = Number(process.env.API_PORT ?? 3001);
  await app.listen(porta);
}
await bootstrap();
