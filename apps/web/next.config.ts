import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

// Política de conteúdo (Etapa 21): só recursos do próprio site. Os scripts inline (tema e dados
// estruturados) pedem 'unsafe-inline'; o resto bloqueia script, iframe e envio para outros
// domínios. Fica de fora do desenvolvimento, onde o Next usa eval para recarregar.
const CSP = [
  "default-src 'self'",
  // Google Tag Manager / Google Ads (só carregam no site público, com Consent Mode).
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net https://www.google.com https://www.googleadservices.com https://pagead2.googlesyndication.com",
  "frame-src 'self' https://www.googletagmanager.com https://*.doubleclick.net",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const producao = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Imagem Docker (NEXT_STANDALONE=1): só o servidor e o que ele importa, a partir da raiz do
  // monorepo. Fora dela (dev e testes), o `next start` de sempre.
  ...(process.env.NEXT_STANDALONE === '1'
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
      }
    : {}),
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
  // Painel P3: o endereço da página da unidade virou /b/<slug>. O antigo /agendar?u=<slug>
  // (divulgado no Instagram, impresso, mandado pelo bot) redireciona com 301 e leva a query junto
  // (o código ?c= do bot continua valendo).
  async redirects() {
    return [
      {
        source: '/agendar',
        has: [{ type: 'query', key: 'u', value: '(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)' }],
        destination: '/b/:slug',
        statusCode: 301,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          ...(producao ? [{ key: 'Content-Security-Policy', value: CSP }] : []),
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
