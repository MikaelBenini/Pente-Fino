// Variáveis dos testes e2e: as do .env da raiz, com ajustes para teste.
import { silenciarAvisoDoPgNoPrisma } from '@pente-fino/db';
import { existsSync } from 'node:fs';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);
silenciarAvisoDoPgNoPrisma();

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.LIMITE_AUTH_POR_MINUTO = '20';
// Os testes criam várias contas pelo mesmo IP e na hora (o teste da proteção liga de volta).
process.env.CADASTRO_TEMPO_MINIMO_MS = '0';
process.env.CADASTRO_LIMITE_POR_HORA = '1000';
process.env.CADASTRO_LIMITE_POR_DIA = '1000';
// Sem WhatsApp de verdade: o provedor falso guarda o que "enviou" e simula o QR.
process.env.WHATSAPP_PROVEDOR = 'falso';
process.env.DOMINIO_VERIFICACAO = 'falso';
process.env.COBRANCA_PROVEDOR = 'falso';
process.env.ASAAS_WEBHOOK_TOKEN = 'token-do-webhook-asaas-teste';
