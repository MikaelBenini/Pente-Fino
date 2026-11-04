import { carregarConfiguracao, ConfiguracaoInvalidaError } from './configuracao.js';

const valido = {
  APP_URL: 'http://localhost:3000/',
  API_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://app:x@localhost:5432/pente_fino',
  REDIS_URL: 'redis://localhost:6379/0',
  JWT_ACCESS_SECRET: 'segredo-de-desenvolvimento',
  WHATSAPP_WEBHOOK_SEGREDO: 'w'.repeat(40),
  EVOLUTION_API_KEY: 'chave-da-evolution',
};

describe('carregarConfiguracao', () => {
  it('aplica padrões e converte durações', () => {
    const c = carregarConfiguracao(valido);
    expect(c.appUrl).toBe('http://localhost:3000');
    expect(c.acessoExpiraEmS).toBe(900);
    expect(c.renovacaoExpiraEmMs).toBe(30 * 86_400_000);
    expect(c.apiDocs).toBe(true);
  });

  it('lista em português o que falta', () => {
    expect(() => carregarConfiguracao({ ...valido, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => carregarConfiguracao({ ...valido, DATABASE_URL: undefined })).toThrow(
      ConfiguracaoInvalidaError,
    );
  });

  it('em produção recusa o segredo de exemplo e desliga a documentação', () => {
    expect(() =>
      carregarConfiguracao({
        ...valido,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'troque-em-producao-acesso',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
    const c = carregarConfiguracao({
      ...valido,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'x'.repeat(48),
    });
    expect(c.apiDocs).toBe(false);
  });

  it('WhatsApp: webhook padrão a partir da API e segredo forte em produção', () => {
    expect(carregarConfiguracao(valido).whatsapp).toEqual({
      provedor: 'evolution',
      evolutionUrl: 'http://localhost:8080',
      evolutionChave: 'chave-da-evolution',
      webhookSegredo: 'w'.repeat(40),
      webhookUrl: 'http://localhost:3001/webhooks/whatsapp',
    });
    expect(() => carregarConfiguracao({ ...valido, WHATSAPP_WEBHOOK_SEGREDO: 'curto' })).toThrow(
      /WHATSAPP_WEBHOOK_SEGREDO/,
    );
    expect(() =>
      carregarConfiguracao({
        ...valido,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'x'.repeat(48),
        WHATSAPP_WEBHOOK_SEGREDO: 'troque-este-segredo-do-webhook-dev',
      }),
    ).toThrow(/WHATSAPP_WEBHOOK_SEGREDO/);
  });

  it('homologação liga a documentação à mão', () => {
    const c = carregarConfiguracao({
      ...valido,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'x'.repeat(48),
      API_DOCS: 'true',
    });
    expect(c.apiDocs).toBe(true);
  });
});
