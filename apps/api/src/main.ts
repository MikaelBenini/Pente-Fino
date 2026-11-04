import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { silenciarAvisoDoPgNoPrisma } from '@pente-fino/db';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { carregarConfiguracao, ConfiguracaoInvalidaError } from './config/configuracao.js';
import { configurarApp } from './configurar-app.js';

// Em desenvolvimento o .env fica na raiz do monorepo; em produção as variáveis vêm do Docker.
const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);
silenciarAvisoDoPgNoPrisma();

async function bootstrap() {
  try {
    carregarConfiguracao(); // falha cedo, com a lista do que falta, antes de montar a aplicação
  } catch (e) {
    if (e instanceof ConfiguracaoInvalidaError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = configurarApp(app);
  await app.listen(config.porta);
}
await bootstrap();
