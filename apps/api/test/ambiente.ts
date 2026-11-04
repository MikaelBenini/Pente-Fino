// Variáveis dos testes e2e: as do .env da raiz, com ajustes para teste.
import { silenciarAvisoDoPgNoPrisma } from '@pente-fino/db';
import { existsSync } from 'node:fs';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);
silenciarAvisoDoPgNoPrisma();

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.LIMITE_AUTH_POR_MINUTO = '20';
// Sem WhatsApp de verdade: o provedor falso guarda o que "enviou" e simula o QR.
process.env.WHATSAPP_PROVEDOR = 'falso';
