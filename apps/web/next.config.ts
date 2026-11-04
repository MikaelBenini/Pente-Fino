import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';

// Em desenvolvimento o .env fica na raiz do monorepo (API_URL e companhia).
const envDaRaiz = new URL('../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

// Em desenvolvimento, o Next só entrega os recursos internos (/_next, recarga automática)
// para "localhost". Aberto por 127.0.0.1 ou pelo endereço do Codespace, ele responde
// "Unauthorized" no lugar do JavaScript e o navegador acusa erro de sintaxe ao navegar.
const codespace =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? [`${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`]
    : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', ...codespace],
  cacheComponents: true,
  experimental: {
    // O app logado é montado no navegador depois de carregar a sessão (a Casca decide o
    // menu e o acesso). A validação de "navegação instantânea" do Next não consegue
    // renderizar essas telas no servidor e acusava erro em toda navegação em
    // desenvolvimento. Ela fica só para as telas que declararem `instant`.
    instantInsights: { validationLevel: 'manual-warning' },
  },
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
      {
        // O service worker nunca fica em cache: atualização chega no próximo acesso.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
