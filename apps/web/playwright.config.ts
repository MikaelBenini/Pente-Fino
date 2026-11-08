import { defineConfig, devices } from '@playwright/test';

// Pronto quando da Etapa 5: cada papel entra e vê só o menu dele, no celular e no computador.
// Precisa do banco com o seed de demonstração (pnpm db:seed) e da API compilada.
const CI = !!process.env.CI;
// Portas próprias (E2E_PORTA_WEB/E2E_PORTA_API) deixam rodar ao lado do pnpm dev.
const PORTA_WEB = Number(process.env.E2E_PORTA_WEB ?? 3000);
const PORTA_API = Number(process.env.E2E_PORTA_API ?? 3001);
const reaproveitar = !CI && !process.env.E2E_PORTA_WEB;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Visitante que já respondeu o aviso de cookies do site (senão ele cobre botões no rodapé).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${PORTA_WEB}`,
          localStorage: [{ name: 'pf-cookies', value: 'recusado' }],
        },
      ],
    },
  },
  projects: [
    {
      name: 'computador',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } },
    },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: `http://localhost:${PORTA_API}/health`,
      reuseExistingServer: reaproveitar,
      // O limite de login já é testado na API (auth.e2e-spec.ts); aqui os mesmos usuários
      // da demonstração entram dezenas de vezes por minuto.
      env: {
        LOG_LEVEL: 'warn',
        API_PORT: String(PORTA_API),
        LIMITE_AUTH_POR_MINUTO: '60',
        // Sem WhatsApp de verdade: a tela de conexão mostra um QR de teste.
        WHATSAPP_PROVEDOR: 'falso',
        COBRANCA_PROVEDOR: 'falso',
      },
      timeout: 60_000,
    },
    {
      command: `pnpm exec next start --port ${PORTA_WEB}`,
      url: `http://localhost:${PORTA_WEB}/entrar`,
      reuseExistingServer: reaproveitar,
      env: { API_URL: `http://localhost:${PORTA_API}` },
      timeout: 120_000,
    },
  ],
});
